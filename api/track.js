export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { departure, arrival, outbound, return_date, type, adults, travel_class } = req.body;

    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        return res.status(500).json({ error: '尚未設定 Vercel KV 資料庫環境變數' });
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
        const response = await fetch(`${url}/set/current_track`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(JSON.stringify(subscription))
        });

        if (!response.ok) {
            throw new Error('Failed to save to KV');
        }

        res.status(200).json({ success: true, message: '成功加入追蹤！' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: '寫入資料庫失敗' });
    }
}
