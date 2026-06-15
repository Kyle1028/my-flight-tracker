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
        
        if (!getData) {
            redis.disconnect();
            return res.status(200).json({ message: 'No flight being tracked.' });
        }

        let track = typeof getData === 'string' ? JSON.parse(getData) : getData;
        const flexDays = track.flexDays || 0;
        const lowestPriceSeen = track.lowestPriceSeen || Infinity;

        // Helper function to add days to a YYYY-MM-DD string
        const addDays = (dateStr, days) => {
            if (!dateStr) return null;
            const date = new Date(dateStr);
            date.setDate(date.getDate() + days);
            return date.toISOString().split('T')[0];
        };

        const envKeys = process.env.SERPAPI_KEY || "8c13e91561e822cd82870a20d66060d8f89f41a4adf8a2ffabdad520566f39f9";
        const keysArray = envKeys.split(',').map(k => k.trim()).filter(k => k);
        const SERP_API_KEY = keysArray[Math.floor(Math.random() * keysArray.length)];
        
        let overallCheapestFlight = null;
        let overallCheapestPrice = Infinity;
        let cheapestOutboundDate = track.outbound;
        let cheapestReturnDate = track.return_date;
        let cheapestBookingUrl = null;

        // Loop through flexDays offsets
        for (let offset = -flexDays; offset <= flexDays; offset++) {
            const currentOutbound = addDays(track.outbound, offset);
            const currentReturn = addDays(track.return_date, offset);

            let searchUrl = `https://serpapi.com/search.json?engine=google_flights&departure_id=${track.departure}&arrival_id=${track.arrival}&outbound_date=${currentOutbound}&currency=TWD&hl=zh-tw&api_key=${SERP_API_KEY}`;
            if (track.type) searchUrl += `&type=${track.type}`;
            if (track.adults) searchUrl += `&adults=${track.adults}`;
            if (track.travel_class) searchUrl += `&travel_class=${track.travel_class}`;
            if (track.type !== '2' && currentReturn) {
                searchUrl += `&return_date=${currentReturn}`;
            }

            try {
                const serpRes = await fetch(searchUrl);
                const data = await serpRes.json();

                if (data.error) continue; // Skip if this specific date combo errors out

                let allFlights = [];
                if (data.best_flights) allFlights = allFlights.concat(data.best_flights);
                if (data.other_flights) allFlights = allFlights.concat(data.other_flights);

                if (allFlights.length > 0) {
                    allFlights.sort((a, b) => a.price - b.price);
                    const cheapestForDate = allFlights[0];
                    if (cheapestForDate.price < overallCheapestPrice) {
                        overallCheapestPrice = cheapestForDate.price;
                        overallCheapestFlight = cheapestForDate;
                        cheapestOutboundDate = currentOutbound;
                        cheapestReturnDate = currentReturn;
                        cheapestBookingUrl = data.search_metadata ? data.search_metadata.google_flights_url : null;
                    }
                }
            } catch (err) {
                console.error(`Error fetching for offset ${offset}:`, err);
            }
        }

        // 3. Compare with lowestPriceSeen and Send LINE Notification
        if (overallCheapestFlight && overallCheapestPrice < lowestPriceSeen) {
            const airline = overallCheapestFlight.flights[0].airline;
            
            const messageText = `🚨 降價通知！找到更便宜的日子了\n${track.departure} ➡️ ${track.arrival}\n原本最低價: NT$ ${lowestPriceSeen === Infinity ? '--' : lowestPriceSeen.toLocaleString()}\n🎉 最新最低價: NT$ ${overallCheapestPrice.toLocaleString()}\n\n最便宜出發日: ${cheapestOutboundDate} ${track.type === '1' ? `~ ${cheapestReturnDate}` : ''}\n航空公司: ${airline}\n🔗 立即查看/購買:\n${cheapestBookingUrl}`;

            const linePayload = {
                to: lineUserId,
                messages: [{ type: 'text', text: messageText }]
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
                console.error("LINE Messaging API Error:", lineErr);
            } else {
                // Update the lowest price in Redis so we don't alert again unless it drops further
                track.lowestPriceSeen = overallCheapestPrice;
                await redis.set('current_track', JSON.stringify(track));
            }
            
            redis.disconnect();
            return res.status(200).json({ success: true, message: 'Price dropped, notification sent!' });
        } else {
            redis.disconnect();
            return res.status(200).json({ message: 'No lower flights found.' });
        }

    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
