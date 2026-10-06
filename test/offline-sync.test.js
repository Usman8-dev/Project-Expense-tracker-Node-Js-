// Tests for the offline-sync guarantees on the API side:
//   - X-Client-Op-Id replay must never execute a write twice
//   - failed writes must be retryable
//   - Bearer + cookie token extraction
//
// Run:  npm test   (node --test, no database required)

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

/* ---- fake model, injected before the middleware is loaded ----------- */
const modelPath = require.resolve('../Models/IdempotencyModel');

const fakeModel = {
    rows: new Map(), // key: `${userId}:${opId}`

    reset() {
        this.rows.clear();
    },

    async create({ opId, user, status }) {
        const key = `${user}:${opId}`;
        if (this.rows.has(key)) {
            const err = new Error('E11000 duplicate key error');
            err.code = 11000;
            throw err;
        }
        const doc = {
            _id: `id-${this.rows.size + 1}`,
            opId,
            user,
            status,
            statusCode: 0,
            response: null,
        };
        this.rows.set(key, doc);
        return doc;
    },

    async findOne({ opId, user }) {
        return this.rows.get(`${user}:${opId}`) || null;
    },

    async updateOne(filter, update) {
        for (const doc of this.rows.values()) {
            if (doc._id === filter._id) Object.assign(doc, update);
        }
        return { acknowledged: true };
    },

    async deleteOne(filter) {
        for (const [key, doc] of this.rows) {
            if (doc._id === filter._id) this.rows.delete(key);
        }
        return { acknowledged: true };
    },
};

require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: fakeModel,
};

const { idempotency } = require('../Middlewares/idempotency');
const { extractToken } = require('../Middlewares/IsLoginUser');

/* ---- express-like req/res doubles ----------------------------------- */
function makeReq({ opId, userId = 'user-1' } = {}) {
    return {
        headers: opId ? { 'x-client-op-id': opId } : {},
        user: userId ? { id: userId } : null,
        get(name) {
            return this.headers[String(name).toLowerCase()];
        },
    };
}

function makeRes(statusCode = 200) {
    return {
        statusCode,
        headers: {},
        body: undefined,
        set(name, value) {
            this.headers[name] = value;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

/**
 * Runs the middleware and resolves as soon as it makes a decision:
 * `{ nextCalled: true }` (request proceeds) or `{ nextCalled: false }`
 * (a stored response was replayed straight to the client).
 */
function run(req, res) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const done = (result) => {
            if (!settled) {
                settled = true;
                resolve(result);
            }
        };

        // The middleware wraps res.json, so registering our watcher first
        // means it runs inside the middleware's wrapper.
        const originalJson = res.json;
        res.json = function (body) {
            originalJson.call(this, body);
            done({ nextCalled: false });
        };

        try {
            idempotency(req, res, () => done({ nextCalled: true }));
        } catch (error) {
            reject(error);
            return;
        }

        setImmediate(() => done({ nextCalled: true, unfinished: true }));
    });
}

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
    fakeModel.reset();
});

/* ---- tests ----------------------------------------------------------- */

describe('idempotency middleware', () => {
    test('passes through when no X-Client-Op-Id header is sent', async () => {
        const { nextCalled, unfinished } = await run(makeReq({ opId: null }), makeRes());
        assert.equal(nextCalled, true);
        assert.equal(unfinished, undefined, 'middleware must settle synchronously');
        assert.equal(fakeModel.rows.size, 0, 'no reservation should be made');
    });

    test('passes through when the request is unauthenticated', async () => {
        const { nextCalled } = await run(makeReq({ opId: 'op-1', userId: null }), makeRes());
        assert.equal(nextCalled, true);
        assert.equal(fakeModel.rows.size, 0);
    });

    test('stores the response of a successful write', async () => {
        const res = makeRes();
        const { nextCalled } = await run(makeReq({ opId: 'op-1' }), res);
        assert.equal(nextCalled, true, 'first attempt must reach the controller');

        // the controller answers
        res.status(201).json({ success: true, expense: { _id: 'exp-1' } });
        await flush();

        assert.equal(fakeModel.rows.size, 1);
        const [doc] = [...fakeModel.rows.values()];
        assert.equal(doc.status, 'completed');
        assert.equal(doc.statusCode, 201);
        assert.deepEqual(doc.response, { success: true, expense: { _id: 'exp-1' } });
    });

    test('replaying the same opId returns the original response without re-running', async () => {
        const first = makeRes();
        await run(makeReq({ opId: 'op-2' }), first);
        first.status(201).json({ success: true, expense: { _id: 'exp-2' } });
        await flush();

        // this is exactly what the PWA outbox does after a lost response
        const retry = makeRes();
        const { nextCalled } = await run(makeReq({ opId: 'op-2' }), retry);

        assert.equal(nextCalled, false, 'controller must NOT run a second time');
        assert.equal(retry.statusCode, 201);
        assert.deepEqual(
            retry.body,
            { success: true, expense: { _id: 'exp-2' } },
            'same _id must come back so offline references can be remapped'
        );
        assert.equal(retry.headers['X-Idempotent-Replay'], 'true');
        assert.equal(fakeModel.rows.size, 1, 'still exactly one record');
    });

    test('a failed write is forgotten, so the client can retry it', async () => {
        const first = makeRes();
        await run(makeReq({ opId: 'op-3' }), first);
        first.status(422).json({ success: false, errors: ['Title is required'] });
        await flush();

        assert.equal(fakeModel.rows.size, 0, 'failed attempts must not be remembered');

        const retry = makeRes();
        const { nextCalled } = await run(makeReq({ opId: 'op-3' }), retry);
        assert.equal(nextCalled, true, 'retry must reach the controller');
    });

    test('different operations do not collide', async () => {
        const first = makeRes();
        await run(makeReq({ opId: 'op-A' }), first);
        first.status(201).json({ ok: 1 });
        await flush();

        const second = makeRes();
        const { nextCalled } = await run(makeReq({ opId: 'op-B' }), second);
        assert.equal(nextCalled, true, 'a new opId must always run');
    });

    test('the same opId from a different user is independent', async () => {
        const first = makeRes();
        await run(makeReq({ opId: 'op-U', userId: 'user-1' }), first);
        first.status(201).json({ ok: 1 });
        await flush();

        const second = makeRes();
        const { nextCalled } = await run(makeReq({ opId: 'op-U', userId: 'user-2' }), second);
        assert.equal(nextCalled, true, 'another user is never replayed');
    });
});

describe('token extraction', () => {
    test('prefers the Authorization header', () => {
        const req = {
            headers: { authorization: 'Bearer abc.def.ghi' },
            cookies: { token: 'cookie-token' },
        };
        assert.equal(extractToken(req), 'abc.def.ghi');
    });

    test('falls back to the cookie', () => {
        const req = { headers: {}, cookies: { token: 'cookie-token' } };
        assert.equal(extractToken(req), 'cookie-token');
    });

    test('ignores the literal "undefined" the frontend used to send', () => {
        const req = { headers: { authorization: 'Bearer undefined' }, cookies: {} };
        assert.equal(extractToken(req), null, 'must be treated as logged out');
    });

    test('returns null when there is nothing at all', () => {
        assert.equal(extractToken({ headers: {} }), null);
    });
});
