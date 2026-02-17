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
  available: boolean;
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
    const psychologists: Psychologist[] = [];
    const seenUrls = new Set<string>();

    // Each card is a <div wire:key="ID"> block containing:
    //   - <a href="/psicologo/slug-ID"> wrapping the card
    //   - background-image:url(https://cademeupsi.com.br/storage/users/HASH.jpg) for the photo
    //   - "🟢 Disponível hoje" in a <span> if available
    //   - CRP number in a <span> (number and "CRP" on separate spans)
    //   - Name in an <a> tag with uppercase text
    //   - Description in a <p> tag after the card

    // Split by wire:key to isolate each card block
    const cardBlocks = html.split(/wire:key="/);

    for (let i = 1; i < cardBlocks.length; i++) {
      const block = cardBlocks[i];

      // Check if this card is available today
      const isAvailable = /Dispon[ií]vel\s+hoje/i.test(block);

      // Extract profile URL
      const hrefMatch = block.match(/href="([^"]*\/psicologo\/[^"]*)"/);
      if (!hrefMatch) continue;

      const href = hrefMatch[1];
      const profileUrl = href.startsWith("http")
        ? href
        : `https://cademeupsi.com.br${href}`;

      if (seenUrls.has(profileUrl)) continue;
      seenUrls.add(profileUrl);

      // Extract photo from background-image:url(...)
      let photo = "";
      const bgMatch = block.match(/background-image:\s*url\(\s*([^)]+)\s*\)/);
      if (bgMatch) {
        photo = bgMatch[1].trim();
        if (!photo.startsWith("http")) {
          photo = `https://cademeupsi.com.br${photo}`;
        }
      }

      // Extract name: the name <a> has class "text-md" (DESTAQUE <a> has "text-xs")
      let name = "";
      const nameMatch = block.match(/<a[^>]*class="[^"]*text-md[^"]*"[^>]*>\s*([^<]+)/);
      if (nameMatch) {
        const rawName = nameMatch[1].trim();
        if (rawName.length > 2) {
          name = rawName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        }
      }

      // Fallback: extract from URL slug
      if (!name) {
        const slugMatch = href.match(/\/psicologo\/([^/]+?)(?:-\d+)?$/);
        if (slugMatch) {
          name = slugMatch[1].replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        }
      }

      if (!name) continue;

      // Extract CRP — number is in one span, "CRP" in another
      let crp = "";
      const crpMatch = block.match(/(\d{2}\/\d{3,6})\s*<\/span>\s*<span[^>]*>\s*CRP/);
      if (crpMatch) {
        crp = crpMatch[1];
      } else {
        // Fallback: simpler pattern
        const crpFallback = block.match(/(\d{2}\/\d{3,6})/);
        if (crpFallback) crp = crpFallback[1];
      }

      // Extract description from <p> tag
      let description = "";
      const descMatch = block.match(/<p[^>]*class="[^"]*text-sm[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/p>/);
      if (descMatch) {
        description = descMatch[1]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .substring(0, 200);
      }

      // Extract numeric ID from slug for WhatsApp URL
      const idMatch = href.match(/-(\d+)$/);
      const whatsappUrl = idMatch
        ? `https://cademeupsi.com.br/whatsapp/${idMatch[1]}`
        : "";

      psychologists.push({ name, photo, crp, profileUrl, description, abordagem: "", especialidade: "", atendimento: "", whatsappUrl, available: isAvailable });
    }

    // Fetch individual profiles in parallel to extract abordagem
    await Promise.allSettled(
      psychologists.map(async (psi, idx) => {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 5000);
          const profRes = await fetch(psi.profileUrl, {
            headers: { "User-Agent": "AcolheBem-Bot/1.0", "Accept": "text/html" },
            signal: ctrl.signal,
          });
          clearTimeout(timer);
          if (!profRes.ok) return;
          const profHtml = await profRes.text();

          // Helper: extract a labeled field value from profile HTML
          const extractField = (label: string): string => {
            const re = new RegExp(label + '[^<]*<\\/[^>]+>\\s*<[^>]+>\\s*([^<]+)', 'i');
            const m = profHtml.match(re);
            return m ? m[1].trim() : "";
          };

          psychologists[idx].abordagem = extractField("Abordagem");
          psychologists[idx].atendimento = extractField("Atendimento");

          // Especialidade — may be a longer text block
          const espMatch = profHtml.match(/Especialidade[^<]*<\/[^>]+>\s*<[^>]+>([\s\S]*?)<\/[^>]+>/i);
          if (espMatch) {
            psychologists[idx].especialidade = espMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 300);
          }

        } catch {
          // Fail silently — abordagem stays empty
        }
      })
    );

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
          "Cache-Control": "public, max-age=1800",
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
