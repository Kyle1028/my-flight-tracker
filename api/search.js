export default async function handler(req, res) {
    const { departure, arrival, outbound, return_date, type, adults, travel_class } = req.query;
    // 支援多組 API Key (以逗號分隔)，隨機挑選一組來分攤額度
    const envKeys = process.env.SERPAPI_KEY || "8c13e91561e822cd82870a20d66060d8f89f41a4adf8a2ffabdad520566f39f9";
    const keysArray = envKeys.split(',').map(k => k.trim()).filter(k => k);
    const API_KEY = keysArray[Math.floor(Math.random() * keysArray.length)];

    if (!API_KEY) {
        return res.status(500).json({ error_message: "伺服器未設定 API Key" });
    }

    let url = `https://serpapi.com/search.json?engine=google_flights&departure_id=${departure}&arrival_id=${arrival}&outbound_date=${outbound}&currency=TWD&hl=zh-tw&api_key=${API_KEY}`;
    
    if (type) url += `&type=${type}`;
    if (adults) url += `&adults=${adults}`;
    if (travel_class) url += `&travel_class=${travel_class}`;
    
    if (type !== '2' && return_date) {
        url += `&return_date=${return_date}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();

        // 🔥 新增：攔截 SerpApi 的官方錯誤訊息（例如額度用完、金鑰錯誤）
        if (data.error) {
            return res.status(200).json({ error_message: `API 錯誤：${data.error}` });
        }

        // Google Flights 有時會把票放在 best_flights，有時在 other_flights
        const booking_url = data.search_metadata ? data.search_metadata.google_flights_url : null;
        
        let allFlights = [];
        if (data.best_flights) allFlights = allFlights.concat(data.best_flights);
        if (data.other_flights) allFlights = allFlights.concat(data.other_flights);

        if (allFlights.length > 0) {
            // 找出價格最低的航班
            allFlights.sort((a, b) => a.price - b.price);
            const cheapestFlight = allFlights[0];
            
            res.status(200).json({
                price: cheapestFlight.price,
                airline: cheapestFlight.flights[0].airline,
                booking_url
            });
        } else {
            res.status(200).json({ error_message: "目前此日期或航線真的查無合適航班。" });
        }
    } catch (error) {
        res.status(500).json({ error_message: "Vercel 伺服器連線發生異常" });
    }
}