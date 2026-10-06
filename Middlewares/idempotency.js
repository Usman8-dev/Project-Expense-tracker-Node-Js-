const IdempotencyModel = require('../Models/IdempotencyModel');

const isDuplicateKeyError = (err) => err && err.code === 11000;

/**
 * Makes POST/PUT/DELETE replay-safe for the offline outbox.
 *
 * The PWA queues writes while offline and replays them when the connection
 * comes back. If the response to the first attempt was lost (timeout, cold
 * start, closed tab) the client retries with the same `X-Client-Op-Id` -
 * without this middleware that would create a duplicate record.
 *
 * Behaviour:
 *  - no header        -> untouched (old clients keep working)
 *  - first attempt    -> record reserved, response stored on success
 *  - replay (2xx)     -> original response is returned, nothing runs twice
 *  - replay (4xx/5xx) -> record was removed, so a genuine retry can run
 */
const idempotency = async (req, res, next) => {
    const header = req.get('X-Client-Op-Id') || req.get('x-client-op-id');
    const opId = typeof header === 'string' ? header.trim() : '';
    const userId = req.user && req.user.id;

    if (!opId || !userId) return next();

    let record;
    try {
        record = await IdempotencyModel.create({
            opId,
            user: userId,
            status: 'in_progress',
        });
    } catch (err) {
        if (!isDuplicateKeyError(err)) {
            // Never block a real write because bookkeeping failed.
            console.error('[idempotency] reserve failed:', err.message);
            return next();
        }

        try {
            const existing = await IdempotencyModel.findOne({ opId, user: userId });
            if (existing && existing.status === 'completed') {
                res.set('X-Idempotent-Replay', 'true');
                return res
                    .status(existing.statusCode || 200)
                    .json(existing.response || { success: true, replay: true });
            }
        } catch (lookupErr) {
            console.error('[idempotency] replay lookup failed:', lookupErr.message);
        }

        // Another request with the same id is mid-flight: let this one run
        // rather than lose the response (the unique index still guards the
        // store, and two identical writes are only possible in that window).
        return next();
    }

    const originalJson = res.json.bind(res);
    let persisted = false;

    res.json = (body) => {
        if (!persisted) {
            persisted = true;
            const succeeded = res.statusCode >= 200 && res.statusCode < 400;
            const op = succeeded
                ? IdempotencyModel.updateOne(
                      { _id: record._id },
                      { status: 'completed', statusCode: res.statusCode, response: body }
                  )
                : IdempotencyModel.deleteOne({ _id: record._id });

            op.catch((err) => console.error('[idempotency] persist failed:', err.message));
        }
        return originalJson(body);
    };

    next();
};

module.exports = { idempotency };
