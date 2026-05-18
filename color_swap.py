import re
import glob

files = ["src/App.tsx", "src/components/QuoteHistory.tsx", "src/components/Toast.tsx"]

color_map = {
    "bg-[#0A0A0A]": "bg-[#F3F4F6]",
    "bg-[#0a0a0a]": "bg-[#F3F4F6]",
    "bg-[#111]": "bg-white",
    "bg-[#111]/50": "bg-[#F9FAFB]",
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
    "bg-white text-black border-white": "bg-[#374151] text-white border-[#374151]",
    "hover:border-white": "hover:border-[#374151]",
    "bg-transparent text-white border-white": "bg-transparent text-[#374151] border-[#374151]",
    
    "hover:bg-[#111]": "hover:bg-[#F3F4F6]",
}

for filepath in files:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
            
        for k, v in color_map.items():
            text = text.replace(k, v)

        # specific fixes for button texts
        text = text.replace("bg-[#059669] text-[#111827]", "bg-[#059669] text-white")
        text = text.replace("bg-transparent text-[#111827] border-[#374151] hover:bg-[#374151] hover:text-black", "bg-transparent text-[#374151] border-[#374151] hover:bg-[#374151] hover:text-white")
        text = text.replace("text-[#111827] px-2 py-0.5", "text-white px-2 py-0.5")
        text = text.replace("bg-[#059669]/10 text-[#111827]", "bg-[#059669]/10 text-[#059669]")
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)
    except FileNotFoundError:
        pass
