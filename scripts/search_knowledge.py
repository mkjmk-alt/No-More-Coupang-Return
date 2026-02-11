
import json

file_path = r'c:\Users\JEONG\.gemini\antigravity\scratch\No-More-Coupang-Return\src\data\knowledge.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Try to find the Expiration/Consumption date section
# In the previous view_file, I saw "Page 43" mentioned "유통(소비)기한 및 제조일자 기준"
search_terms = ["유통(소비)기한", "소비기한", "50%", "40%", "잔여"]

results = []
for term in search_terms:
    index = content.find(term)
    if index != -1:
        # Get context around the match
        start = max(0, index - 500)
        end = min(len(content), index + 1500)
        results.append(f"--- Match for '{term}' ---\n{content[start:end]}\n")

with open('search_results.txt', 'w', encoding='utf-8') as f:
    f.write("\n".join(results))
