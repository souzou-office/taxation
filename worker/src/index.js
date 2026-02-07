export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    // ベクトル検索エンドポイント
    if (url.pathname === '/api/search' && request.method === 'POST') {
      try {
        const { query } = await request.json();

        // Workers AIでembedding生成（条文くんと同じモデル）
        const embeddingResult = await env.AI.run('@cf/baai/bge-m3', {
          text: [query],
        });
        const queryVector = embeddingResult.data[0];

        // Vectorizeで検索
        const searchResults = await env.VECTORIZE.query(queryVector, {
          topK: 20,
          returnMetadata: true,
        });

        // R2から本文取得
        const results = await Promise.all(
          searchResults.matches.map(async (match) => {
            let text = '';
            try {
              const obj = await env.R2.get(`tsutatsu/${match.id}.json`);
              if (obj) {
                const data = await obj.json();
                text = data.text || '';
              }
            } catch (e) {
              // R2 lookup failed, skip
            }
            return {
              id: match.id,
              score: match.score,
              metadata: match.metadata,
              text,
            };
          })
        );

        return new Response(JSON.stringify({ results }), { headers: corsHeaders });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // 通達本文取得
    if (url.pathname === '/api/article' && request.method === 'GET') {
      const id = url.searchParams.get('id');
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id parameter required' }),
          { status: 400, headers: corsHeaders }
        );
      }
      try {
        const obj = await env.R2.get(`tsutatsu/${id}.json`);
        if (!obj) {
          return new Response(
            JSON.stringify({ error: 'not found' }),
            { status: 404, headers: corsHeaders }
          );
        }
        const data = await obj.json();
        return new Response(JSON.stringify(data), { headers: corsHeaders });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 500, headers: corsHeaders }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'not found' }),
      { status: 404, headers: corsHeaders }
    );
  },
};
