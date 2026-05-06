export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // Or specify your frontend origin
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle OPTIONS request for preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Missing form URL parameter.' });
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Could not load form page.`);
        }
        const html = await response.text();

        // Use a broad match to capture the full JSON blob
        const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/);
        let data;
        
        if (!match) {
            // Fallback: try simpler pattern
            const match2 = html.match(/FB_PUBLIC_LOAD_DATA_ = (.*)/);
            if (!match2) {
                throw new Error("Could not find form data. Make sure the form is public and the URL is correct.");
            }
            const rawJson = match2[1].replace(/;$/, '');
            data = JSON.parse(rawJson);
        } else {
            data = JSON.parse(match[1]);
        }

        const fields = [];

        // Google Forms FB_PUBLIC_LOAD_DATA_ structure:
        // data[1][1] = array of question items
        // q[1]       = question label (string)
        // q[3]       = question type (0=short, 1=paragraph, 2=radio, etc.)
        // q[4]       = array of input groups
        // q[4][0][0] = entry ID (a number, e.g. 123456789)
        if (data && data[1] && data[1][1]) {
            const questionList = data[1][1];
            questionList.forEach(q => {
                const label = q[1];
                const itemType = q[3];

                if (q[4] && Array.isArray(q[4])) {
                    for (const inputGroup of q[4]) {
                        // Entry ID is a NUMBER at index 0, not an array
                        if (inputGroup && typeof inputGroup[0] === 'number') {
                            const entryId = `entry.${inputGroup[0]}`;
                            fields.push({
                                label: label || "Untitled Question",
                                id: entryId,
                                type: itemType
                            });
                            break;
                        }
                    }
                }
            });
        }

        // Also find formResponse URL
        const formIdMatch = html.match(/\/forms\/d\/e\/(.*?)\//);
        const formResponseUrl = formIdMatch
            ? `https://docs.google.com/forms/d/e/${formIdMatch[1]}/formResponse`
            : url.replace(/viewform|edit/, 'formResponse');

        return res.status(200).json({ fields, formResponseUrl });
    } catch (error) {
        console.error("Form fetch error:", error);
        return res.status(500).json({ error: error.message });
    }
}
