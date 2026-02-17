import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CADEMEUPSI_URL = "https://cademeupsi.com.br/psicologos";

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 1. Fetch listing page to discover all profile URLs
    const response = await fetch(CADEMEUPSI_URL, {
      headers: {
        "User-Agent": "AcolheBem-Bot/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ psychologists: [], count: 0, fetchedAt: new Date().toISOString() }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        }
      );
    }

    const html = await response.text();

    // 2. Extract ALL unique /psicologo/ URLs from the full HTML
    //    The listing page uses Livewire infinite scroll (perPage=12),
    //    but ALL profile URLs are present in the HTML (links, DESTAQUE, etc.)
    const urlRegex = /href="((?:https:\/\/cademeupsi\.com\.br)?\/psicologo\/[^"]+)"/g;
    const seenUrls = new Set<string>();
    const profileEntries: { profileUrl: string; slug: string; numericId: string }[] = [];
    let urlMatch;

    while ((urlMatch = urlRegex.exec(html)) !== null) {
      const href = urlMatch[1];
      const profileUrl = href.startsWith("http")
        ? href
        : `https://cademeupsi.com.br${href}`;

      if (seenUrls.has(profileUrl)) continue;
      seenUrls.add(profileUrl);

      const slugMatch = profileUrl.match(/\/psicologo\/(.+)$/);
      const idMatch = profileUrl.match(/-(\d+)$/);
      if (!slugMatch) continue;

      profileEntries.push({
        profileUrl,
        slug: slugMatch[1],
        numericId: idMatch ? idMatch[1] : "",
      });
    }

    // 3. Fetch each profile page in parallel to extract all data + availability
    const psychologists: Psychologist[] = [];

    const results = await Promise.allSettled(
      profileEntries.map(async (entry) => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const profRes = await fetch(entry.profileUrl, {
            headers: { "User-Agent": "AcolheBem-Bot/1.0", "Accept": "text/html" },
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          if (!profRes.ok) return null;
          const profHtml = await profRes.text();

          // --- Name ---
          let name = "";
          const h1Match = profHtml.match(/<h1[^>]*>\s*([^<]+)/);
          if (h1Match) {
            name = h1Match[1].trim();
          }
          if (!name) {
            // Fallback: extract from slug
            const slugName = entry.slug.replace(/-\d+$/, "").replace(/-/g, " ");
            name = slugName.replace(/\b\w/g, c => c.toUpperCase());
          }
          // Normalize casing (some are ALL CAPS)
          if (name === name.toUpperCase() && name.length > 2) {
            name = name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
          }

          // --- Photo ---
          let photo = "";
          const imgMatch = profHtml.match(/<img[^>]*src="(https:\/\/cademeupsi\.com\.br\/storage\/users\/[^"]+)"/);
          if (imgMatch) {
            photo = imgMatch[1];
          } else {
            const bgMatch = profHtml.match(/background-image:\s*url\(\s*(https:\/\/cademeupsi\.com\.br\/storage\/users\/[^)]+)\s*\)/);
            if (bgMatch) photo = bgMatch[1].trim();
          }

          // --- CRP ---
          let crp = "";
          const crpMatch = profHtml.match(/CRP:?\s*<\/\w+>\s*<\w+[^>]*>\s*(\d{2}\/\d{3,6})/i);
          if (crpMatch) {
            crp = crpMatch[1];
          } else {
            const crpFallback = profHtml.match(/(\d{2}\/\d{3,6})/);
            if (crpFallback) crp = crpFallback[1];
          }

          // --- Helper: extract labeled field ---
          const extractField = (label: string): string => {
            const re = new RegExp(label + '[^<]*<\\/[^>]+>\\s*<[^>]+>\\s*([^<]+)', 'i');
            const m = profHtml.match(re);
            return m ? m[1].trim() : "";
          };

          // --- Abordagem ---
          const abordagem = extractField("Abordagem");

          // --- Atendimento ---
          const atendimento = extractField("Atendimento");

          // --- Especialidade ---
          let especialidade = "";
          const espMatch = profHtml.match(/Especialidade[^<]*<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i);
          if (espMatch) {
            especialidade = espMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 300);
          }

          // --- Description ---
          let description = "";
          const descMatch = profHtml.match(/Sobre mim[^<]*<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i);
          if (descMatch) {
            description = descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 200);
          }

          // --- Availability: check for "Xh Ymin restante" pattern ---
          let available = false;
          let hoursRemaining = -1;
          const timeMatch = profHtml.match(/(\d+)h\s*(\d+)?\s*min\s*restante/i);
          if (timeMatch) {
            available = true;
            const h = parseInt(timeMatch[1], 10);
            const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            hoursRemaining = h + m / 60;
          }
          // Also check "disponibilidade de agenda" as backup
          if (!available && /disponibilidade\s+de\s+agenda/i.test(profHtml)) {
            available = true;
          }

          // --- WhatsApp number (personal, from wPsy field in embedded JSON) ---
          let whatsappNumber = "";
          // wPsy contains the psychologist's personal wa.me link: &quot;wPsy&quot;:&quot;https:\/\/wa.me\/5517996578809?text=Oi&quot;
          const wPsyMatch = profHtml.match(/&quot;wPsy&quot;:&quot;[^&]*wa\.me[^&]*?(\d{10,15})/);
          if (wPsyMatch) {
            whatsappNumber = wPsyMatch[1];
          } else {
            // Fallback: extract from phone field and normalize to international format
            const phoneMatch = profHtml.match(/&quot;phone&quot;:&quot;\((\d{2})\)\s*(\d{4,5})-?(\d{4})&quot;/);
            if (phoneMatch) {
              whatsappNumber = `55${phoneMatch[1]}${phoneMatch[2]}${phoneMatch[3]}`;
            }
          }

          // --- WhatsApp URL (fallback redirect link) ---
          let whatsappUrl = "";
          const wppMatch = profHtml.match(/href="((?:https:\/\/cademeupsi\.com\.br)?\/whatsapp\/\d+)"/i);
          if (wppMatch) {
            whatsappUrl = wppMatch[1].startsWith("http")
              ? wppMatch[1]
              : `https://cademeupsi.com.br${wppMatch[1]}`;
          } else if (entry.numericId) {
            whatsappUrl = `https://cademeupsi.com.br/whatsapp/${entry.numericId}`;
          }

          return {
            name, photo, crp, profileUrl: entry.profileUrl,
            description, abordagem, especialidade, atendimento,
            whatsappUrl, whatsappNumber, available, hoursRemaining,
          } as Psychologist;
        } catch {
          clearTimeout(timer);
          return null;
        }
      })
    );

    // Collect successful results
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        psychologists.push(r.value);
      }
    }

    // Sort: available first, then by name
    psychologists.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

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
      }
    );
  } catch (err) {
    console.error("psi-available error:", err);
    return new Response(
      JSON.stringify({ psychologists: [], count: 0, fetchedAt: new Date().toISOString() }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
      }
    );
  }
});
