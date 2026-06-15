const Redis = require('ioredis');

export default async function handler(req, res) {
    const redisUrl = process.env.REDIS_URL;
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const lineUserId = process.env.LINE_USER_ID;

    if (!redisUrl || !lineToken || !lineUserId) {
        return res.status(500).json({ error: 'Missing REDIS or LINE Tokens' });
    }

    try {
        // 1. Get current track
        const redis = new Redis(redisUrl);
        const getData = await redis.get('current_track');
        redis.disconnect();
        
        if (!getData) {
            return res.status(200).json({ message: 'No flight being tracked.' });
        }

        let track = typeof getData === 'string' ? JSON.parse(getData) : getData;

        // 2. Fetch SerpApi
        const SERP_API_KEY = process.env.SERPAPI_KEY || "8c13e91561e822cd82870a20d66060d8f89f41a4adf8a2ffabdad520566f39f9";
        let searchUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${track.departure}&arrival_id=${track.arrival}&outbound_date=${track.outbound}&currency=TWD&hl=zh-tw&api_key=${SERP_API_KEY}`;
        if (track.type) searchUrl += `&type=${track.type}`;
        if (track.adults) searchUrl += `&adults=${track.adults}`;
        if (track.travel_class) searchUrl += `&travel_class=${track.travel_class}`;
        if (track.type !== '2' && track.return_date) {
            searchUrl += `&return_date=${track.return_date}`;
        }

        const serpRes = await fetch(searchUrl);
        const data = await serpRes.json();

        if (data.error) {
            return res.status(500).json({ error: data.error });
        }

        let allFlights = [];
        if (data.best_flights) allFlights = allFlights.concat(data.best_flights);
        if (data.other_flights) allFlights = allFlights.concat(data.other_flights);

        if (allFlights.length > 0) {
            allFlights.sort((a, b) => a.price - b.price);
            const cheapestFlight = allFlights[0];
            const price = cheapestFlight.price;
            const airline = cheapestFlight.flights[0].airline;
            const booking_url = data.search_metadata ? data.search_metadata.google_flights_url : null;

            // 3. Send via LINE Messaging API
            const messageText = `✈️ 航班價格通知\n${track.departure} ➡️ ${track.arrival}\n日期: ${track.outbound} ${track.type === '1' ? `~ ${track.return_date}` : ''}\n💰 最低價格: NT$ ${price.toLocaleString()}\n航空公司: ${airline}\n🔗 立即查看/購買:\n${booking_url}`;

            const linePayload = {
                to: lineUserId,
                messages: [
                    {
                        type: 'text',
                        text: messageText
                    }
                ]
            };

            const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${lineToken}`
                },
                body: JSON.stringify(linePayload)
            });

            if (!lineRes.ok) {
                const lineErr = await lineRes.text();
                console.error("Line Notify Error:", lineErr);
                return res.status(500).json({ error: 'Line Notify Failed' });
            }

            return res.status(200).json({ success: true, message: 'Notification sent!' });
        } else {
            return res.status(200).json({ message: 'No flights found.' });
        }

    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
