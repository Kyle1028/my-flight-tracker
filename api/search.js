export default async function handler(req, res) {
    // 取得前端傳來的日期
    const { outbound, return_date } = req.query;
    
    // 從 Vercel 環境變數讀取你的 SerpApi Key (絕對安全)
    const API_KEY = process.env.SERPAPI_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: "伺服器未設定 API Key" });
    }

    // 組合給 SerpApi 的網址
    const url = `https://serpapi.com/search.json?engine=google_flights&departure_id=TPE&arrival_id=FUK&outbound_date=${outbound}&return_date=${return_date}&currency=TWD&hl=zh-tw&api_key=${API_KEY}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.best_flights && data.best_flights.length > 0) {
            const bestFlight = data.best_flights[0];
            res.status(200).json({
                price: bestFlight.price,
                airline: bestFlight.flights[0].airline
            });
        } else {
            res.status(200).json({ error: "No flights found" });
        }
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch data" });
    }
}