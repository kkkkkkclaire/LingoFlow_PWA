import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Swap .features and .lang-select in #landing-page
features_start = content.find('<section class="features">')
lang_select_start = content.find('<section class="lang-select">')
footer_start = content.find('<footer class="landing-footer">')

features_html = content[features_start:lang_select_start]
lang_select_html = content[lang_select_start:footer_start]

# Swap them
content = content[:features_start] + lang_select_html + features_html + content[footer_start:]

# 2. Extract .lang-selector and .section-tabs from header
header_start = content.find('<header>')
header_end = content.find('</header>') + len('</header>')

header_html = content[header_start:header_end]
# Extract the parts
lang_selector_match = re.search(r'<div class="lang-selector">.*?</div>', header_html, re.DOTALL)
section_tabs_match = re.search(r'<div class="section-tabs">.*?</div>', header_html, re.DOTALL)

lang_selector_html = lang_selector_match.group(0)
section_tabs_html = section_tabs_match.group(0)

# Create simplified header
new_header = '''<header>
      <button class="back-btn" onclick="backToLanding()">← 主页</button>
      <div class="logo">LingoFlow<span>语流</span></div>
    </header>'''

content = content.replace(header_html, new_header)

# 3. Create and inject .bottom-tab-bar before <footer> in #learning-page
bottom_bar_html = f'''
    <nav class="bottom-tab-bar">
      {lang_selector_html}
      {section_tabs_html}
    </nav>
'''
learning_footer_start = content.find('<footer>LingoFlow 语流', header_end)
content = content[:learning_footer_start] + bottom_bar_html + content[learning_footer_start:]

# 4. Add CSS for bottom-tab-bar
css_to_add = '''
    /* ===== Bottom Tab Bar ===== */
    .bottom-tab-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      background: var(--glass-bg);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border-top: 1px solid var(--glass-border);
      z-index: 990;
      display: flex;
      flex-direction: column;
      padding-bottom: env(safe-area-inset-bottom);
      box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
    }
    
    .bottom-tab-bar .lang-selector {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      padding: 10px 15px;
      gap: 8px;
      border-bottom: 1px solid rgba(255,255,255,0.3);
    }
    
    .bottom-tab-bar .lang-selector::-webkit-scrollbar {
      display: none; /* Hide scrollbar for cleaner UI */
    }
    
    .bottom-tab-bar .lang-btn {
      flex: 0 0 auto;
      font-size: 0.8rem;
      padding: 6px 14px;
    }

    .bottom-tab-bar .section-tabs {
      display: flex;
      justify-content: space-around;
      padding: 10px 5px;
      gap: 5px;
    }

    .bottom-tab-bar .tab-btn {
      flex: 1;
      font-size: 0.75rem;
      padding: 8px 4px;
      text-align: center;
      border-radius: 8px;
      background: transparent;
      border: none;
      white-space: nowrap;
    }

    .bottom-tab-bar .tab-btn.active {
      background: rgba(255, 255, 255, 0.6);
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }

    main {
      padding-bottom: 140px; /* Make space for bottom bar */
    }
    
    /* Adjust header layout */
    header {
      justify-content: space-between;
      padding: 15px 24px;
    }
    
    /* Responsive tweaks */
    @media (max-width: 600px) {
      .bottom-tab-bar .tab-btn {
        font-size: 0.65rem;
      }
    }
'''

style_end_index = content.find('</style>')
content = content[:style_end_index] + css_to_add + content[style_end_index:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("HTML restructured successfully.")
