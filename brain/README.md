# Climate Taxonomy Brain

Type or paste a text. The page marks the words that are in the CGIAR climate adaptation
taxonomy, tells you which ones are synonyms of an agreed term, and shows whether the text
describes a complete impact pathway.

**Live page:** https://mlolita26.github.io/climate-taxonomy-brain/

## How it works, in plain words

1. **A lookup list.** For every concept in the taxonomy, take its preferred term and all its
   synonyms. About 1,700 phrases, each pointing to one concept.
2. **Read the text.** Words are put in a simple form: lower case, no plural, hyphens as spaces.
   So "cropping systems" and "cropping-system" both match "Crop system".
3. **Find the longest match.** At each word, the page looks for the longest phrase that is in
   the list. Found phrases are marked: green if the preferred term was used, amber if a synonym.
4. **Apply the pathway rule.** Each tagged concept belongs to one pathway element: rationale,
   intervention, system/who, result. A term that is *adaptation-specific* (drought, drip
   irrigation) counts on its own. A term that is *adaptation-conditional* (maize, farmer, yield)
   counts only if it is linked to a specific term: through a relation stored in the taxonomy,
   or, if the box is ticked, because the text names a specific term somewhere.
5. **Count the elements.** Four elements evidenced: Full. Three or two: Partial. One: Minimal.
   None: None. So "fertilizer to raise maize yields" tags six concepts but scores None, because
   none of them is linked to a climate hazard.

There is no AI in the page. The AI step, checking that a word really means the concept in its
context, is what the PRMS tagging pipeline adds on top.

## Files

| File | What it is |
| --- | --- |
| `build_brain.R` | Reads the taxonomy, prepares the data and the rule parameters, writes the page. Run with `Rscript build_brain.R`. |
| `data/taxonomy_v5.json` | The taxonomy (739 concepts). Replace it to use another taxonomy. |
| `template/brain.html` | The page layout and the matching and counting code. |
| `docs/index.html` | The built page, served by GitHub Pages. |
| `test_rule.js` | Runs the samples from the command line: `node test_rule.js`. |

## Data source

The taxonomy this page reads is published as a FAIR vocabulary (SKOS) at
https://mlolita26.github.io/cgiar-climate-taxonomy/ (repository: Mlolita26/cgiar-climate-taxonomy).
This page still embeds its own copy of `taxonomy_v5.json`; reading the published JSON-LD directly is the next step.
