import fs from 'fs';

const files = ["src/App.tsx", "src/components/QuoteHistory.tsx", "src/components/Toast.tsx"];

const colorMap: Record<string, string> = {
    "bg-[#0A0A0A]": "bg-[#F3F4F6]",
    "bg-[#0a0a0a]": "bg-[#F3F4F6]",
    "bg-[#111]": "bg-white",
    "bg-[#111]/50": "bg-white/50",
    "bg-black": "bg-white",
    "bg-[#050505]": "bg-[#F9FAFB]",
    "bg-[#0d0d0d]": "bg-[#F9FAFB]",
    "bg-[#0c0c0c]": "bg-[#F9FAFB]",
    "bg-[#1a1a1a]": "bg-[#F3F4F6]",
    "bg-[#222]": "bg-[#E5E7EB]",
    
    "border-[#111]": "border-white",
    "border-[#333]": "border-[#D1D5DB]",
    "border-[#222]": "border-[#E5E7EB]",
    "border-[#1a1a1a]": "border-[#E5E7EB]",
    "border-white": "border-[#374151]",
    
    "text-white": "text-[#111827]",
    "text-gray-300": "text-[#374151]",
    "text-gray-400": "text-[#4B5563]",
    "text-gray-500": "text-[#6B7280]",
    "text-gray-600": "text-[#9CA3AF]",
    "hover:text-white": "hover:text-[#111827]",
    "focus:text-white": "focus:text-[#111827]",
    "bg-transparent text-white": "bg-transparent text-[#111827]",
    "placeholder:opacity-30 text-white": "placeholder:opacity-30 text-[#111827]",
    
    "#FF4D00": "#059669",
    "bg-blue-600": "bg-teal-500",
    "bg-purple-600": "bg-emerald-700",
    "bg-pink-600": "bg-emerald-400",
    "255, 77, 0": "5, 150, 105",
    
    "border-white/20": "border-[#374151]/20",
    "border-white/30": "border-[#374151]/30",
    "hover:border-white": "hover:border-[#374151]",
    "bg-transparent text-white border-white": "bg-transparent text-[#374151] border-[#374151]",
    "bg-white text-black border-white": "bg-[#374151] text-white border-[#374151]",
    
    "hover:bg-[#111]": "hover:bg-[#F3F4F6]"
};

for (const filepath of files) {
    if (fs.existsSync(filepath)) {
        let text = fs.readFileSync(filepath, 'utf-8');
        
        for (const [k, v] of Object.entries(colorMap)) {
            text = text.split(k).join(v);
        }

        text = text.split('bg-[#059669] text-[#111827]').join('bg-[#059669] text-white');
        text = text.split('text-[#111827] px-2 py-0.5').join('text-white px-2 py-0.5');
        text = text.split('bg-[#059669]/10 text-[#111827]').join('bg-[#059669]/10 text-[#059669]');
        text = text.split('hover:bg-[#374151] hover:text-black').join('hover:bg-[#374151] hover:text-white');
        text = text.split('hover:bg-white hover:text-black').join('hover:bg-slate-800 hover:text-white');
        
        fs.writeFileSync(filepath, text);
    }
}
