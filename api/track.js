const Redis = require('ioredis');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { departure, arrival, outbound, return_date, type, adults, travel_class } = req.body;

    const url = process.env.REDIS_URL;

    if (!url) {
        return res.status(500).json({ error: '尚未設定 REDIS_URL 環境變數' });
    }

    const subscription = {
        departure,
        arrival,
        outbound,
        return_date,
        type,
        adults,
        travel_class,
        timestamp: new Date().toISOString()
    };

    try {
        const redis = new Redis(url);
        await redis.set('current_track', JSON.stringify(subscription));
        redis.disconnect();

        res.status(200).json({ success: true, message: '成功加入追蹤！' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '寫入資料庫失敗' });
    }
}
