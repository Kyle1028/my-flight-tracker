async function test() {
    const url = 'https://thorough-pebble-cozy-76293.db.redis.io';
    const token = 'hIODUlgTVU1Css7U74sqPnoR47ll5oVQ';
    
    // For Upstash REST API, the token is usually the token from the console. 
    // Sometimes the token is just the password? Let's check or encode it?
    // According to Upstash docs, Authorization header is `Bearer <token>`
    
    try {
        const res = await fetch(`${url}/set/foo/bar`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const text = await res.text();
        console.log("REST API Response:", res.status, text);
    } catch (e) {
        console.error("REST error:", e);
    }
}
test();
