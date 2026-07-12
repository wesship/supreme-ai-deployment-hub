from pathlib import Path

path = Path('src/pages/Index.tsx')
text = path.read_text()

replacements = [
    ("import Footer from '@/components/Footer';", "import HomepageShell from '@/components/homepage/HomepageShell';\nimport HomepageCTAGroup from '@/components/homepage/HomepageCTAGroup';"),
    ("""            <div className=\"mt-9 flex flex-col gap-3 sm:flex-row\">\n              <SmartLaunchLink\n                authedTo=\"/app\"\n                className=\"d3-command-surface inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-[0_0_38px_rgba(37,126,255,0.45)] hover:bg-blue-400\"\n              >\n                <Command className=\"h-4 w-4\" aria-hidden=\"true\" />\n                Enter D3VONN.IO\n              </SmartLaunchLink>\n              <Link\n                to=\"/solutions\"\n                className=\"inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-200/20 bg-white/[0.035] px-6 py-3 font-semibold text-blue-50 backdrop-blur hover:border-blue-200/40 hover:bg-blue-300/[0.08]\"\n              >\n                Explore the platform <ArrowRight className=\"h-4 w-4\" />\n              </Link>\n            </div>""", """            <HomepageCTAGroup className=\"mt-9\" />"""),
    ("""    <div className=\"d3-os-shell flex min-h-screen flex-col overflow-hidden text-white\">""", """    <HomepageShell>"""),
    ("""      <main id=\"main-content\">""", """      <>"""),
    ("""      </main>\n\n      <Footer />\n    </div>""", """      </>\n    </HomepageShell>"""),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'Expected exactly one match, found {count}: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text)
print('Homepage shell migration applied successfully.')
