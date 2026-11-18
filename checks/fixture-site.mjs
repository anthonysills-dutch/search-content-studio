// A small coffee-roaster website served locally: the pages research briefs
// read, the page a document imports, and the site an audit crawls.
import http from "node:http";

const page = ({ title, description, h1s = [], body, links = [] }) => `<!doctype html>
<html><head>${title ? `<title>${title}</title>` : ""}${description ? `<meta name="description" content="${description}">` : ""}</head>
<body><nav>${links.map((href) => `<a href="${href}">${href}</a>`).join(" ")}</nav>
${h1s.map((h) => `<h1>${h}</h1>`).join("")}
${body}
<script>var tracking = "ignore me";</script></body></html>`;

const para = (text, times) => Array.from({ length: times }, () => `<p>${text}</p>`).join("\n");

const coldBrewGuide = page({
  title: "How to make cold brew coffee at home",
  description: "A step by step cold brew recipe with ratios and steeping times.",
  h1s: ["How to make cold brew coffee"],
  links: ["/", "/guides/grind-size", "/about"],
  body: `
<h2>What is cold brew coffee?</h2>
${para("Cold brew coffee is coffee steeped in cold water for 12 to 18 hours. The slow extraction gives a smooth, low acidity concentrate that keeps in the fridge for two weeks.", 6)}
<h2>What ratio of coffee to water should I use?</h2>
${para("Use a coarse grind and a ratio of one part coffee to eight parts water for a ready to drink brew, or one to four for a concentrate you dilute with milk or ice.", 6)}
<h2>How long should cold brew steep?</h2>
${para("Steep the grounds for 16 hours at room temperature or 20 hours in the fridge, then filter through a paper filter or a fine mesh sieve.", 6)}
<h3>Filtering and storage</h3>
<ul><li>Filter twice for a clean cup</li><li>Store the concentrate in a sealed jar</li><li>Dilute with ice before serving</li></ul>`,
});

const grindGuide = page({
  title: "Coffee grind size chart for every brew method",
  description: "Which grind size to use for cold brew, French press, pour over and espresso.",
  h1s: ["Coffee grind size chart"],
  links: ["/", "/guides/cold-brew"],
  body: `
<h2>Why does grind size matter?</h2>
${para("Grind size controls extraction. A coarse grind suits cold brew and French press, while espresso needs a fine grind and a short contact time.", 7)}
<h2>Best grind for cold brew</h2>
${para("For cold brew use a coarse grind similar to sea salt. A burr grinder gives an even particle size and a less bitter concentrate.", 7)}`,
});

const recipePage = page({
  title: "Cold brew concentrate recipe",
  description: "",
  h1s: ["Cold brew concentrate", "Our recipe"],
  links: ["/", "/guides/cold-brew"],
  body: `
<h2>Can you make cold brew with regular coffee?</h2>
${para("Yes. Any medium or dark roast works for cold brew coffee, ground coarse, steeped overnight and filtered in the morning for a smooth concentrate.", 5)}
<h2>Ingredients</h2>
<ul><li>200 grams of coarse ground coffee</li><li>1.6 litres of cold filtered water</li></ul>`,
});

const pages = {
  "/": page({
    title: "Ember Roasters | Small batch coffee",
    description: "Small batch coffee roasted every week.",
    h1s: ["Small batch coffee, roasted weekly"],
    links: ["/guides/cold-brew", "/guides/grind-size", "/recipes/concentrate", "/about", "/old-page"],
    body: para("We roast single origin coffee in small batches every Tuesday and ship it the same week.", 30),
  }),
  "/guides/cold-brew": coldBrewGuide,
  "/guides/grind-size": grindGuide,
  "/recipes/concentrate": recipePage,
  "/about": page({ title: "Ember Roasters | Small batch coffee", h1s: [], links: ["/"], body: "<p>About us.</p>" }),
  "/wholesale": page({ title: "Wholesale coffee for cafes", description: "Wholesale beans for cafes.", h1s: ["Wholesale"], links: ["/"], body: para("We supply cafes and offices with fresh roasted beans on a weekly schedule.", 30) }),
};

export async function startFixtureSite() {
  const server = http.createServer((request, response) => {
    const { pathname } = new URL(request.url, "http://fixture");
    const origin = `http://localhost:${server.address().port}`;
    if (pathname === "/robots.txt") {
      response.writeHead(200, { "content-type": "text/plain" });
      return response.end(`User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
    }
    if (pathname === "/sitemap.xml") {
      response.writeHead(200, { "content-type": "application/xml" });
      const urls = ["/", "/guides/cold-brew", "/guides/grind-size", "/wholesale"];
      return response.end(`<?xml version="1.0"?><urlset>${urls.map((u) => `<url><loc>${origin}${u}</loc></url>`).join("")}</urlset>`);
    }
    const html = pages[pathname];
    if (!html) {
      response.writeHead(404, { "content-type": "text/html" });
      return response.end("<html><head><title>Not found</title></head><body><h1>Not found</h1></body></html>");
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://localhost:${server.address().port}`;
  return { origin, close: () => new Promise((resolve) => server.close(resolve)) };
}
