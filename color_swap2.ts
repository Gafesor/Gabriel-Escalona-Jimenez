import fs from 'fs';

function swapColors(filepath: string) {
    if (!fs.existsSync(filepath)) return;
    let content = fs.readFileSync(filepath, 'utf8');

    // text-[#064E3B] to text-gray-900 
    content = content.replace(/text-\[\#064E3B\]/g, "text-gray-900");
    // text-[#059669] to text-emerald-800
    content = content.replace(/text-\[\#059669\]/g, "text-emerald-800");

    fs.writeFileSync(filepath, content);
    console.log(`Updated ${filepath}`);
}

swapColors('src/App.tsx');
swapColors('src/components/QuoteHistory.tsx');
