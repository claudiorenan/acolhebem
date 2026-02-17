import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CADEMEUPSI_URL = "https://cademeupsi.com.br/psicologos";
const LIVEWIRE_URL = "https://cademeupsi.com.br/livewire/update";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

interface Psychologist {
  name: string;
  photo: string;
  crp: string;
  profileUrl: string;
  description: string;
  abordagem: string;
  especialidade: string;
  atendimento: string;
  whatsappUrl: string;
  whatsappNumber: string;
  available: boolean;
  hoursRemaining: number;
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Parse cards from listing HTML using wire:key blocks */
function parseCardsFromListing(html: string): Psychologist[] {
  const results: Psychologist[] = [];

  // Find all card positions by wire:key="NNNN" (3-6 digit numeric IDs)
  const cardRegex = /wire:key="(\d{3,6})"/g;
  const positions: { id: string; start: number }[] = [];
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    positions.push({ id: match[1], start: match.index });
  }

  for (let i = 0; i < positions.length; i++) {
    const { id, start } = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1].start : start + 5000;
    const card = html.substring(start, end);

    // Profile URL + slug
    const slugMatch = card.match(/\/psicologo\/([a-z0-9-]+-\d+)/);
    if (!slugMatch) continue;
    const slug = slugMatch[1];
    const profileUrl = `https://cademeupsi.com.br/psicologo/${slug}`;

    // Name (inside the <a> with hover:underline)
    let name = "";
    const nameMatch = card.match(/hover:underline">\s*([^<]+)/);
    if (nameMatch) name = nameMatch[1].trim();
    if (!name) {
      const slugName = slug.replace(/-\d+$/, "").replace(/-/g, " ");
      name = slugName.replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
    // Fix ALL CAPS names
    if (name === name.toUpperCase() && name.length > 2) {
      name = name.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    }

    // Photo (background-image URL)
    let photo = "";
    const bgMatch = card.match(/background-image:url\(\s*(https:\/\/cademeupsi\.com\.br\/storage\/users\/[^)]+)/);
    if (bgMatch) photo = bgMatch[1].trim();

    // CRP
    let crp = "";
    const crpMatch = card.match(/<span[^>]*>(\d{2}\/\d{3,6})<\/span>/);
    if (crpMatch) crp = crpMatch[1];

    // Description (short, from the <p> tag)
    let description = "";
    const descMatch = card.match(/<p[^>]*class="pointer-events-none[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/);
    if (descMatch) {
      description = descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 200);
    }

    // Available
    const available = card.includes("Disponível hoje");

    // WhatsApp URL (constructed from numeric ID)
    const whatsappUrl = `https://cademeupsi.com.br/whatsapp/${id}`;

    results.push({
      name,
      photo,
      crp,
      profileUrl,
      description,
      abordagem: "",
      especialidade: "",
      atendimento: "",
      whatsappUrl,
      whatsappNumber: "",
      available,
      hoursRemaining: -1,
    });
  }

  return results;
}

/** Enrich a single psychologist from their individual profile page */
async function enrichOne(psi: Psychologist): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(psi.profileUrl, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return;
    const html = await res.text();

    // Abordagem
    const aboMatch = html.match(/Abordagem[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)/i);
    if (aboMatch) psi.abordagem = aboMatch[1].trim();

    // Atendimento
    const ateMatch = html.match(/Atendimento[^<]*<\/[^>]+>\s*<[^>]+>\s*([^<]+)/i);
    if (ateMatch) psi.atendimento = ateMatch[1].trim();

    // Especialidade
    const espMatch = html.match(/Especialidade[^<]*<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i);
    if (espMatch) {
      psi.especialidade = espMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 300);
    }

    // Full description (from profile - overrides listing desc)
    const descMatch = html.match(/Sobre mim[^<]*<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i);
    if (descMatch) {
      psi.description = descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 500);
    }

    // Availability hours
    const timeMatch = html.match(/(\d+)h\s*(\d+)?\s*min\s*restante/i);
    if (timeMatch) {
      const h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      psi.hoursRemaining = h + m / 60;
    }
    if (!psi.available && /disponibilidade\s+de\s+agenda/i.test(html)) {
      psi.available = true;
    }

    // WhatsApp number (personal - from wPsy field)
    const wPsyMatch = html.match(/&quot;wPsy&quot;:&quot;[^&]*wa\.me[^&]*?(\d{10,15})/);
    if (wPsyMatch) {
      psi.whatsappNumber = wPsyMatch[1];
    } else {
      const phoneMatch = html.match(/&quot;phone&quot;:&quot;\((\d{2})\)\s*(\d{4,5})-?(\d{4})&quot;/);
      if (phoneMatch) {
        psi.whatsappNumber = `55${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}`;
      }
    }

    // WhatsApp URL from profile page
    const wppMatch = html.match(/href="((?:https:\/\/cademeupsi\.com\.br)?\/whatsapp\/\d+)"/i);
    if (wppMatch) {
      psi.whatsappUrl = wppMatch[1].startsWith("http")
        ? wppMatch[1]
        : `https://cademeupsi.com.br${wppMatch[1]}`;
    }
  } catch {
    clearTimeout(timer);
  }
}

/** Enrich ALL psychologists by fetching their individual profile pages in batches */
async function enrichAll(psychologists: Psychologist[]): Promise<void> {
  if (psychologists.length === 0) return;

  const BATCH = 15; // 15 parallel requests at a time
  let enriched = 0;

  for (let i = 0; i < psychologists.length; i += BATCH) {
    const batch = psychologists.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map((psi) => enrichOne(psi)));
    enriched += results.filter((r) => r.status === "fulfilled").length;
    console.log(`Enriched batch ${Math.floor(i / BATCH) + 1}: ${Math.min(i + BATCH, psychologists.length)}/${psychologists.length}`);
  }

  console.log(`Enriched ${enriched}/${psychologists.length} psychologists total`);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // ============================================================
    // STEP 1: Fetch listing page
    // ============================================================
    const initialRes = await fetch(CADEMEUPSI_URL, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
    });

    if (!initialRes.ok) {
      return new Response(
        JSON.stringify({ psychologists: [], count: 0, fetchedAt: new Date().toISOString() }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        },
      );
    }

    const initialHtml = await initialRes.text();

    // ============================================================
    // STEP 2: Parse cookies + XSRF + Livewire snapshot
    // ============================================================
    const cookies: Record<string, string> = {};
    const rawHeaders = initialRes.headers;
    const setCookies = (rawHeaders as any).getSetCookie?.() || [];
    for (const sc of setCookies) {
      const nv = sc.split(";")[0];
      const eq = nv.indexOf("=");
      if (eq > 0) {
        cookies[nv.substring(0, eq).trim()] = nv.substring(eq + 1).trim();
      }
    }
    if (!cookies["XSRF-TOKEN"]) {
      const raw = rawHeaders.get("set-cookie") || "";
      const xm = raw.match(/XSRF-TOKEN=([^;]+)/);
      if (xm) cookies["XSRF-TOKEN"] = xm[1];
      const sm = raw.match(/cade_meu_psi_session=([^;]+)/);
      if (sm) cookies["cade_meu_psi_session"] = sm[1];
    }

    const xsrfToken = decodeURIComponent(cookies["XSRF-TOKEN"] || "");
    const cookieStr = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");

    // Find the psychologists Livewire snapshot
    let currentSnap = "";
    const snapMatches = initialHtml.match(/wire:snapshot="([^"]+)"/g);
    if (snapMatches) {
      for (const sm of snapMatches) {
        const raw = sm.replace('wire:snapshot="', "").replace(/"$/, "");
        const decoded = raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
        if (decoded.includes("web.psychologists")) {
          currentSnap = decoded;
          break;
        }
      }
    }

    // ============================================================
    // STEP 3: Call loadMore() to get all 115+ cards
    //         perPage doubles each call: 12→24→48→96→192→...
    //         We need about 4-5 calls until perPage > total cards
    // ============================================================
    let fullHtml = initialHtml;

    if (currentSnap && xsrfToken) {
      let prevPerPage = 12;
      let prevCardCount = 0;
      let stableCount = 0; // how many times card count stayed the same

      for (let i = 0; i < 10; i++) {
        try {
          const payload = JSON.stringify({
            _token: "",
            components: [
              {
                snapshot: currentSnap,
                updates: {},
                calls: [{ path: "", method: "loadMore", params: [] }],
              },
            ],
          });

          const lwRes = await fetch(LIVEWIRE_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Livewire": "",
              "X-XSRF-TOKEN": xsrfToken,
              Cookie: cookieStr,
              "User-Agent": BROWSER_UA,
              Accept: "application/json",
              Referer: CADEMEUPSI_URL,
            },
            body: payload,
          });

          if (!lwRes.ok) {
            console.log(`Livewire call ${i} failed: ${lwRes.status}`);
            break;
          }

          const lwData = await lwRes.json();
          const compHtml: string = lwData?.components?.[0]?.effects?.html || "";
          const newSnap = lwData?.components?.[0]?.snapshot;

          if (newSnap) {
            currentSnap = typeof newSnap === "string" ? newSnap : JSON.stringify(newSnap);
          }

          // Check current perPage from snapshot
          let curPerPage = prevPerPage;
          try {
            const snapObj = JSON.parse(typeof currentSnap === "string" ? currentSnap : "{}");
            curPerPage = snapObj?.data?.perPage || prevPerPage;
          } catch {
            // ignore
          }

          // Count unique profile slugs in response (more reliable than wire:key)
          const slugSet = new Set<string>();
          const slugRe = /\/psicologo\/([a-z0-9-]+-\d+)/g;
          let sm;
          while ((sm = slugRe.exec(compHtml)) !== null) slugSet.add(sm[1]);
          const uniqueProfiles = slugSet.size;

          console.log(`loadMore #${i}: perPage=${curPerPage}, profiles=${uniqueProfiles}, html=${compHtml.length}`);

          if (compHtml.length > 0) {
            fullHtml = compHtml;
          }

          // Stop if perPage didn't grow
          if (curPerPage === prevPerPage) {
            console.log(`perPage unchanged at ${curPerPage}, stopping`);
            break;
          }

          // Stop if profile count stabilized for 2 consecutive calls
          if (uniqueProfiles === prevCardCount && uniqueProfiles > 0) {
            stableCount++;
            if (stableCount >= 2) {
              console.log(`Profile count stable at ${uniqueProfiles}, stopping`);
              break;
            }
          } else {
            stableCount = 0;
          }

          prevPerPage = curPerPage;
          prevCardCount = uniqueProfiles;
        } catch (err) {
          console.log(`Livewire call ${i} error: ${err}`);
          break;
        }
      }
    } else {
      console.log(`Livewire scroll skipped: snap=${!!currentSnap}, xsrf=${!!xsrfToken}`);
    }

    // ============================================================
    // STEP 4: Parse all cards from the listing HTML
    // ============================================================
    const psychologists = parseCardsFromListing(fullHtml);
    console.log(`Parsed ${psychologists.length} psychologists from listing (${psychologists.filter((p) => p.available).length} available)`);

    // ============================================================
    // STEP 5: Enrich ALL psychologists with profile page details
    //         (WhatsApp personal number, abordagem, especialidade, etc.)
    // ============================================================
    await enrichAll(psychologists);

    // Sort: available first, then by name
    psychologists.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

    console.log(`Returning ${psychologists.length} psychologists`);

    return new Response(
      JSON.stringify({
        psychologists,
        count: psychologists.length,
        fetchedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      },
    );
  } catch (err) {
    console.error("psi-available error:", err);
    return new Response(
      JSON.stringify({ psychologists: [], count: 0, fetchedAt: new Date().toISOString() }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      },
    );
  }
});
