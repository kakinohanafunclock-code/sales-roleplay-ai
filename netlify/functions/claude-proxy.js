// netlify/functions/claude-proxy.js
// Netlify Functionsで動作するClaude APIプロキシ

exports.handler = async (event) => {
    // CORSヘッダー設定
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // OPTIONSリクエスト（プリフライト）への対応
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // POSTリクエスト以外は拒否
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // 環境変数からAPIキーを取得
        const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

        if (!CLAUDE_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    message: 'CLAUDE_API_KEY is not set' 
                })
            };
        }

        // リクエストボディをパース
        const { messages, model, max_tokens } = JSON.parse(event.body);

        console.log('🔄 Claude APIにリクエスト送信中...');

        // Claude APIを呼び出し
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model || 'claude-sonnet-4-20250514',
                max_tokens: max_tokens || 1000,
                messages: messages
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Claude API Error:', errorData);
            return {
                statusCode: response.status,
                headers,
                body: JSON.stringify(errorData)
            };
        }

        const data = await response.json();
        console.log('✅ Claude APIから応答受信');

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('❌ Function Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};
