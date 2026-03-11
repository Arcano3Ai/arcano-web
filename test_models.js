const fs = require('fs');

async function testKey() {
    const key = process.argv[2];
    if (!key) {
        console.log("Provide an API Key");
        return;
    }
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if (data.error) {
            console.log("Error v1beta:", data.error.message);
        } else {
            const models = data.models.map(m => m.name);
            console.log("Found models in v1beta:", models.filter(m => m.includes('2.0') || m.includes('2.5')).join(', '));
        }

        const res2 = await fetch(`https://generativelanguage.googleapis.com/v1alpha/models?key=${key}`);
        const data2 = await res2.json();
        if (data2.error) {
            console.log("Error v1alpha:", data2.error.message);
        } else {
            const models2 = data2.models.map(m => m.name);
            console.log("Found models in v1alpha:", models2.filter(m => m.includes('2.0') || m.includes('2.5')).join(', '));
        }

    } catch (e) {
        console.error(e);
    }
}

testKey();
