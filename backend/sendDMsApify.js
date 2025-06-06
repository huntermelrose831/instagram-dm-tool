const { ApifyClient } = require('apify-client');


const client = new ApifyClient({
    token: process.env.APIFY_TOKEN || '<YOUR_API_TOKEN>', // Set your token in .env or replace here
});

async function sendDMsViaApify({ sessionId, usernames, message, delayBetweenMessages = 60 }) {
    if (!Array.isArray(usernames) || usernames.length === 0) {
        throw new Error("Usernames array is empty or invalid.");
    }

    const input = {
        sessionid: sessionId,
        target_usernames: usernames,
        message,
        delay_between_messages: delayBetweenMessages,
        proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ["RESIDENTIAL"],
            apifyProxyCountry: "US",
        },
        max_users: usernames.length,
    };

    try {
        const run = await client.actor("HCeZTYRGtlUT8Sxx6").call(input);
        console.log('Apify run started. Run ID:', run.id);

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        console.log('Results from Apify run:');
        items.forEach(item => console.dir(item));
    } catch (err) {
        console.error("Failed to run Apify actor:", err);
    }
}

module.exports =  { sendDMsViaApify };
