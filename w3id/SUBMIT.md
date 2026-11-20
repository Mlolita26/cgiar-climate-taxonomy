# Permanent addresses through w3id.org: prepared, not submitted

w3id.org gives permanent web addresses that redirect to wherever a resource is hosted. The
vocabulary plans to use `https://w3id.org/cgiar/climate-taxonomy/<ID>` for its terms, so that the
addresses survive a move away from GitHub Pages. The files in this folder are ready; nothing has
been submitted yet (status on 2026-11-20).

| File here | Goes to, in the w3id.org repository |
| --- | --- |
| `.htaccess` | `cgiar/climate-taxonomy/.htaccess` (the redirect rules) |
| `README.md` | `cgiar/README.md` (what the namespace is and who maintains it) |

## Before submitting

1. **Agree who owns `w3id.org/cgiar/`.** No CGIAR namespace exists on w3id.org yet. The folder
   `cgiar/` would serve every CGIAR vocabulary, not only this one, so CGIAR's data and ontology
   community should agree to it and be listed as maintainers. A narrower name (for example
   `w3id.org/cgiar-climate-taxonomy/`) avoids the question but is less tidy.
2. **Add a contact.** w3id.org asks for at least one maintainer who can be reached; add an email
   address or a GitHub account to `README.md` if needed.

## Submitting

1. Fork https://github.com/perma-id/w3id.org.
2. Add the two files at the destinations above.
3. Open a pull request, for example with this text:

   > Add `w3id.org/cgiar/climate-taxonomy` for the CGIAR Climate Adaptation and Mitigation
   > Taxonomy, a SKOS vocabulary (https://github.com/Mlolita26/cgiar-climate-taxonomy). Term
   > identifiers such as `/cgiar/climate-taxonomy/CRK_102` redirect to term pages on GitHub Pages;
   > requests for Turtle or JSON-LD redirect to the vocabulary files. `cgiar/README.md` lists the
   > maintainers.

4. After the merge, test:
   `curl -sI https://w3id.org/cgiar/climate-taxonomy/CRK_102` (expect 303 to the term page) and
   `curl -sI -H "Accept: text/turtle" https://w3id.org/cgiar/climate-taxonomy/CRK_102` (expect 303
   to the Turtle file).

## After the merge

In `build_fair.R`, make the term identifiers `FUTURE_IRI<ID>` (the `ct:` prefix and `term_iri()`),
keep the page addresses on GitHub Pages, rebuild, run the checks and publish a new release. The
GitHub Pages addresses keep working as pages, so nothing that links to them breaks. Update the
FAIR self-assessment (`source/fair_checklist.csv`).
