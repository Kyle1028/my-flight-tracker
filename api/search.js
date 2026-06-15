export default async function handler(req, res) {
    const { departure, arrival, outbound, return_date, type, adults, travel_class } = req.query;
    // 加入您提供的 API Key 作為備用（Vercel 環境變數若沒設定，就使用此 Key）
    const API_KEY = process.env.SERPAPI_KEY || "8c13e91561e822cd82870a20d66060d8f89f41a4adf8a2ffabdad520566f39f9";

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
        if (data.best_flights && data.best_flights.length > 0) {
            const bestFlight = data.best_flights[0];
            res.status(200).json({
                price: bestFlight.price,
                airline: bestFlight.flights[0].airline
            });
        } else if (data.other_flights && data.other_flights.length > 0) {
            const otherFlight = data.other_flights[0];
            res.status(200).json({
                price: otherFlight.price,
                airline: otherFlight.flights[0].airline
            });
        } else {
            res.status(200).json({ error_message: "目前此日期或航線真的查無合適航班。" });
        }
    } catch (error) {
        res.status(500).json({ error_message: "Vercel 伺服器連線發生異常" });
    }
}