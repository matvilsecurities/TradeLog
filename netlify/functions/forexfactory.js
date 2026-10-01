export default async function handler() {
  const source = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

  try {
    const response = await fetch(source, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TradeLog/1.0 Economic Calendar",
      },
    });

    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
        "cache-control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error?.message || "Forex Factory request failed" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
