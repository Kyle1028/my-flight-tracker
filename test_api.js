

async function test() {
    const API_KEY = "8c13e91561e822cd82870a20d66060d8f89f41a4adf8a2ffabdad520566f39f9";
    const url = `https://serpapi.com/search.json?engine=google_flights&departure_id=TPE&arrival_id=FUK&outbound_date=2026-06-16&currency=TWD&hl=zh-tw&api_key=${API_KEY}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
