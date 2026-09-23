# build_fair.R
# Publishes the climate adaptation taxonomy as a draft FAIR vocabulary.
# Reads source/, writes dist/ (Turtle, JSON-LD, CSV) and docs/ (landing page + one page per term).
# Run from this folder:   Rscript build_fair.R      then   Rscript qa/check_skos.R

library(dplyr); library(purrr); library(tidyr); library(stringr); library(readr); library(jsonlite); library(glue)

# 0. Settings: the only block that changes after the build-shop ------------------------------
BASE_IRI  <- "https://mlolita26.github.io/cgiar-climate-taxonomy/"   # provisional: where the pages are served today
FUTURE_IRI <- "https://w3id.org/cgiar/climate-taxonomy/"              # planned permanent namespace (to register after the build-shop)
VERSION   <- "5.0.0-draft"
STATUS    <- "draft"
LICENCE   <- "https://creativecommons.org/licenses/by/4.0/"          # proposed, pending confirmation
CUSTODIAN <- "CGIAR MELIAF Climate Adaptation Activator (Andreea Nowak, Lolita Muller), Alliance of Bioversity International and CIAT"
TITLE     <- "CGIAR Climate Adaptation and Mitigation Taxonomy"
DOI       <- "10.5072/zenodo.607948"                                   # Zenodo SANDBOX test DOI (10.5072 = test prefix); a real 10.5281 DOI comes with v5.0.0
TODAY     <- format(Sys.Date())
SCHEME    <- paste0(BASE_IRI, "scheme")
term_iri  <- function(id) paste0(BASE_IRI, "terms/", id)
future_iri <- function(id) paste0(FUTURE_IRI, id)

# 1. Read the taxonomy ------------------------------------------------------------------------
raw <- read_json("source/taxonomy_v5.json")
concepts <- tibble(
  id            = map_chr(raw$concepts, "id"),
  term          = map_chr(raw$concepts, "term"),
  synonyms      = map(raw$concepts, \(c) as.character(unlist(c$synonyms))),
  facet         = map_chr(raw$concepts, "facet"),
  level         = map_int(raw$concepts, "level"),
  parent_id     = map_chr(raw$concepts, "parent_id", .default = NA_character_),
  definition    = map_chr(raw$concepts, "definition", .default = ""),
  source        = map_chr(raw$concepts, "definition_source", .default = ""),
  urls          = map(raw$concepts, \(c) str_split_1(c$reference_urls %||% "", "[;\\s]+") |> keep(nzchar)),
  stage         = map_chr(raw$concepts, "pathway_stage", .default = ""),
  scope         = map_chr(raw$concepts, "climate_scope", .default = ""),
  adaptation    = map_chr(raw$concepts, c("adaptation", "tag")),
  condition     = map_chr(raw$concepts, c("adaptation", "condition")),
  mitigation    = map_chr(raw$concepts, c("mitigation", "tag")),
  m_condition   = map_chr(raw$concepts, c("mitigation", "condition")),
  is_hazard     = map_lgl(raw$concepts, c("derived", "is_hazard")),
  example       = map_chr(raw$concepts, "cgiar_example", .default = ""),
  provenance    = map_chr(raw$concepts, c("provenance", "source"), .default = "")
) |>
  left_join(read_csv("source/provenance_map.csv", show_col_types = FALSE), by = "provenance") |>
  mutate(prov_class = coalesce(prov_class, "Domain expert"))

relations <- map_dfr(raw$concepts, \(c) map_dfr(c$relations, \(r) tibble(id = c$id, type = r$type, target = r$target))) |>
  filter(target %in% concepts$id) |>
  mutate(prop = str_replace_all(type, "-(\\w)", \(m) toupper(str_sub(m, 2))))       # applies-to -> appliesTo

children <- concepts |> filter(!is.na(parent_id)) |> summarise(kids = list(id), .by = parent_id)
retired  <- read_csv("source/v5_retired_ids.csv", show_col_types = FALSE) |>
  mutate(reason    = paste0(reason, if_else(is.na(successor), "", paste0("; successor note: ", successor))),
         successor = str_extract(successor, "[A-Z]{2,4}_[0-9]+"),                     # "INT_306 Insurance" -> INT_306; "dropped" -> NA
         successor = if_else(successor %in% concepts$id, successor, NA_character_))
facets   <- read_csv("source/master_v5_controlled_values.csv", show_col_types = FALSE) |>
  filter(Column == "Facet") |> transmute(facet = Value, facet_def = Definition,
                                         slug = str_to_lower(facet) |> str_replace_all("[^a-z0-9]+", "-"))
cat(glue("Read {nrow(concepts)} concepts, {nrow(relations)} relations, {nrow(retired)} retired ids, {nrow(facets)} facets\n"))

# 2. Turtle -----------------------------------------------------------------------------------
esc <- function(x) x |> str_replace_all(fixed("\\"), "\\\\") |> str_replace_all(fixed('"'), '\\"') |> str_squish()
lit <- function(x) glue('"{esc(x)}"@en')
opt <- function(pred, values) if (length(values)) glue("{pred} {paste(values, collapse = ' , ')}") else character(0)

prefixes <- glue('
@prefix skos:    <http://www.w3.org/2004/02/skos/core#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl:     <http://www.w3.org/2002/07/owl#> .
@prefix rdfs:    <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:     <http://www.w3.org/2001/XMLSchema#> .
@prefix ct:      <{BASE_IRI}terms/> .
@prefix meliaf:  <{BASE_IRI}relations/> .
')

scheme_ttl <- glue('
<{SCHEME}> a skos:ConceptScheme ;
    dcterms:title {lit(TITLE)} ;
    dcterms:description {lit("Controlled vocabulary for describing climate adaptation and mitigation in agricultural research results: concepts, definitions, synonyms, typed relations, and the conditions under which a term counts as adaptation or mitigation.")} ;
    dcterms:creator {lit(CUSTODIAN)} ;
    dcterms:publisher {lit("Alliance of Bioversity International and CIAT, for the CGIAR MELIAF project")} ;
    dcterms:created "{str_sub(raw$meta$built_at, 1, 10)}"^^xsd:date ;
    dcterms:modified "{TODAY}"^^xsd:date ;
    dcterms:license <{LICENCE}> ;
    dcterms:rights {lit("Licence proposed (CC BY 4.0), pending confirmation by the custodian.")} ;
    owl:versionInfo "{VERSION}" ;
    skos:note {lit(glue("Status: {STATUS}. Published for the MELIAF build-shop (Rabat, October 2026) so the container can be seen working. Identifiers use the GitHub Pages address for now; the planned permanent form is {FUTURE_IRI}<ID>, which will replace it without changing term ids."))} ;
    skos:historyNote {lit("Version 5 built 2026-09-04 from master_v5.csv by build_taxonomy_v5.R; 739 concepts, 0 build errors. Version 4 (626 concepts) is the previous release.")} ;
    rdfs:seeAlso <https://github.com/Mlolita26/cgiar-climate-taxonomy> .
')

concept_ttl <- function(id, term, synonyms, facet, parent_id, definition, source, urls, stage, scope,
                        adaptation, condition, mitigation, m_condition, is_hazard, example, prov_class, provenance, ...) {
  rels <- relations |> filter(id == !!id)
  kids <- children$kids[match(id, children$parent_id)][[1]]
  body <- c(
    "a skos:Concept", glue("skos:inScheme <{SCHEME}>"), glue('skos:notation "{id}"'),
    glue("skos:prefLabel {lit(term)}"),
    opt("skos:altLabel", lit(synonyms)),
    glue("skos:definition {lit(definition)}"),
    if (nzchar(source)) glue('dcterms:source "{esc(source)}"'),
    opt("rdfs:seeAlso", glue("<{urls}>")),
    if (is.na(parent_id)) glue("skos:topConceptOf <{SCHEME}>") else glue("skos:broader ct:{parent_id}"),
    opt("skos:narrower", glue("ct:{kids}")),
    if (adaptation == "Adaptation-conditional") glue("skos:scopeNote {lit(paste('Counts as adaptation when:', condition))}"),
    if (mitigation == "Mitigation-conditional") glue("skos:scopeNote {lit(paste('Counts as mitigation when:', m_condition))}"),
    if (nzchar(example)) glue("skos:example {lit(example)}"),
    glue('meliaf:adaptationTag "{adaptation}"'), glue('meliaf:mitigationTag "{mitigation}"'),
    glue('meliaf:pathwayStage "{stage}"'), glue('meliaf:climateScope "{scope}"'),
    glue("meliaf:isHazard {tolower(is_hazard)}"),
    opt("meliaf:provenance", glue('"{str_split_1(prov_class, "; ")}"')),
    glue("skos:historyNote {lit(paste('Provenance note in the master file:', provenance))}")
  )
  rel_lines <- imap_chr(split(rels$target, rels$prop), \(targets, p) glue("meliaf:{p} {paste0('ct:', targets, collapse = ' , ')}"))
  paste0("ct:", id, " ", paste(c(body, rel_lines), collapse = " ;\n    "), " .\n")
}
concepts_ttl <- pmap_chr(concepts, concept_ttl)

collections_ttl <- pmap_chr(facets, \(facet, facet_def, slug) glue('
ct:facet-{slug} a skos:Collection ;
    skos:inScheme <{SCHEME}> ;
    skos:prefLabel {lit(facet)} ;
    skos:definition {lit(facet_def)} ;
    skos:member {paste0("ct:", concepts$id[concepts$facet == facet], collapse = " , ")} .
'))

retired_ttl <- pmap_chr(retired, \(ID, Term, Facet, successor, reason) glue('
ct:{ID} a skos:Concept ;
    skos:inScheme <{SCHEME}> ;
    skos:notation "{ID}" ;
    skos:prefLabel {lit(Term)} ;
    owl:deprecated true ;
    {if (!is.na(successor)) glue("dcterms:isReplacedBy ct:{successor} ;") else ""}
    skos:changeNote {lit(paste0("Retired in version 5 (", reason, "). Facet was ", Facet, "."))} .
'))

relation_defs <- read_csv("source/relation_definitions.csv", show_col_types = FALSE) |> filter(prop %in% relations$prop)
ontology_ttl <- c(prefixes, glue('
<{BASE_IRI}relations/> a owl:Ontology ;
    dcterms:title {lit("MELIAF relation and rule properties for the climate taxonomy")} ;
    owl:versionInfo "{VERSION}" ;
    rdfs:comment {lit("Small extension of SKOS: the typed relations between concepts that the adaptation and mitigation decision rules use, and the per-concept rule attributes. Everything else in the vocabulary is plain SKOS.")} .
'),
  pmap_chr(relation_defs, \(prop, comment) glue('meliaf:{prop} a owl:ObjectProperty ; rdfs:label "{prop}"@en ; rdfs:comment {lit(comment)} .')),
  glue('meliaf:adaptationTag a owl:DatatypeProperty ; rdfs:label "adaptation tag"@en ; rdfs:comment {lit("Adaptation-specific: the concept counts as adaptation on its own. Adaptation-conditional: it counts only through a qualifying relation to an adaptation-specific concept (see the concept scope note). n/a: not an adaptation term.")} .'),
  glue('meliaf:mitigationTag a owl:DatatypeProperty ; rdfs:label "mitigation tag"@en ; rdfs:comment {lit("Same as the adaptation tag, for the mitigation rule.")} .'),
  glue('meliaf:pathwayStage a owl:DatatypeProperty ; rdfs:label "pathway stage"@en ; rdfs:comment {lit("Position in the results chain: Rationale, Intervention, Stakeholder, Output, Outcome, Impact, Cross-cutting, Uptake stage.")} .'),
  glue('meliaf:climateScope a owl:DatatypeProperty ; rdfs:label "climate scope"@en ; rdfs:comment {lit("Adaptation, Mitigation, or Adaptation + Mitigation.")} .'),
  glue('meliaf:isHazard a owl:DatatypeProperty ; rdfs:label "is hazard"@en ; rdfs:comment {lit("True for the climate hazards that let conditional terms qualify.")} .'),
  glue('meliaf:provenance a owl:DatatypeProperty ; rdfs:label "provenance"@en ; rdfs:comment {lit("Where the concept came from: Lexicon consensus, Domain expert, PRMS pilot, Restructure (v5). A concept may carry several.")} .')
)

dir.create("dist", showWarnings = FALSE)
write_lines(c(prefixes, scheme_ttl, collections_ttl, concepts_ttl, retired_ttl), "dist/climate-taxonomy.ttl")
write_lines(ontology_ttl, "dist/meliaf-relations.ttl")
cat("Wrote dist/climate-taxonomy.ttl and dist/meliaf-relations.ttl\n")

# 3. JSON-LD -----------------------------------------------------------------------------------
iri_prop <- function(x) list("@id" = x, "@type" = "@id")
plain    <- function(x) list("@id" = x, "@language" = NULL)
context <- c(
  list("@language" = "en", skos = "http://www.w3.org/2004/02/skos/core#", dcterms = "http://purl.org/dc/terms/",
       owl = "http://www.w3.org/2002/07/owl#", rdfs = "http://www.w3.org/2000/01/rdf-schema#", xsd = "http://www.w3.org/2001/XMLSchema#",
       ct = paste0(BASE_IRI, "terms/"), meliaf = paste0(BASE_IRI, "relations/"),
       id = "@id", type = "@type",
       prefLabel = "skos:prefLabel", altLabel = "skos:altLabel", definition = "skos:definition", scopeNote = "skos:scopeNote",
       example = "skos:example", changeNote = "skos:changeNote", historyNote = "skos:historyNote", note = "skos:note",
       notation = plain("skos:notation"), source = plain("dcterms:source"), inScheme = iri_prop("skos:inScheme"),
       topConceptOf = iri_prop("skos:topConceptOf"), broader = iri_prop("skos:broader"), narrower = iri_prop("skos:narrower"),
       member = iri_prop("skos:member"), seeAlso = iri_prop("rdfs:seeAlso"), isReplacedBy = iri_prop("dcterms:isReplacedBy"),
       deprecated = list("@id" = "owl:deprecated", "@type" = "xsd:boolean"),
       adaptationTag = plain("meliaf:adaptationTag"), mitigationTag = plain("meliaf:mitigationTag"), pathwayStage = plain("meliaf:pathwayStage"),
       climateScope = plain("meliaf:climateScope"), provenance = plain("meliaf:provenance"),
       isHazard = list("@id" = "meliaf:isHazard", "@type" = "xsd:boolean")),
  set_names(map(relation_defs$prop, \(p) iri_prop(paste0("meliaf:", p))), relation_defs$prop)
)
concept_json <- function(id, term, synonyms, facet, parent_id, definition, source, urls, stage, scope, adaptation, condition,
                         mitigation, m_condition, is_hazard, example, prov_class, provenance, ...) {
  rels <- relations |> filter(id == !!id)
  kids <- children$kids[match(id, children$parent_id)][[1]]
  compact(c(list(
    id = paste0("ct:", id), type = "skos:Concept", inScheme = SCHEME, notation = id, prefLabel = term,
    altLabel = if (length(synonyms)) I(synonyms), definition = definition, source = if (nzchar(source)) source,
    seeAlso = if (length(urls)) I(urls),
    topConceptOf = if (is.na(parent_id)) SCHEME, broader = if (!is.na(parent_id)) paste0("ct:", parent_id),
    narrower = if (length(kids)) I(paste0("ct:", kids)),
    scopeNote = if (adaptation == "Adaptation-conditional") paste("Counts as adaptation when:", condition),
    example = if (nzchar(example)) example,
    adaptationTag = adaptation, mitigationTag = mitigation, pathwayStage = stage, climateScope = scope, isHazard = is_hazard,
    provenance = I(str_split_1(prov_class, "; ")), historyNote = paste("Provenance note in the master file:", provenance)),
    if (nrow(rels)) map(split(paste0("ct:", rels$target), rels$prop), I) else list()))
}
graph <- c(
  list(compact(list(id = SCHEME, type = "skos:ConceptScheme", "dcterms:title" = TITLE, "dcterms:creator" = CUSTODIAN,
                    "dcterms:license" = list("@id" = LICENCE), "owl:versionInfo" = VERSION, "dcterms:modified" = TODAY,
                    note = paste("Status:", STATUS)))),
  pmap(facets, \(facet, facet_def, slug) list(id = paste0("ct:facet-", slug), type = "skos:Collection", prefLabel = facet,
                                              definition = facet_def, member = I(paste0("ct:", concepts$id[concepts$facet == facet])))),
  pmap(concepts, concept_json),
  pmap(retired, \(ID, Term, Facet, successor, reason) compact(list(
    id = paste0("ct:", ID), type = "skos:Concept", inScheme = SCHEME, notation = ID, prefLabel = Term, deprecated = TRUE,
    isReplacedBy = if (!is.na(successor)) paste0("ct:", successor), changeNote = paste0("Retired in version 5 (", reason, ")."))))
)
write_json(list("@context" = context, "@graph" = graph), "dist/climate-taxonomy.jsonld", auto_unbox = TRUE, pretty = TRUE, null = "null")
cat("Wrote dist/climate-taxonomy.jsonld\n")

# 4. Flat CSV and CHANGELOG ----------------------------------------------------------------------
concepts |>
  transmute(id, iri = term_iri(id), term, synonyms = map_chr(synonyms, paste, collapse = "; "), facet, level, parent_id,
            definition, definition_source = source, pathway_stage = stage, climate_scope = scope,
            adaptation_tag = adaptation, adaptation_condition = condition, mitigation_tag = mitigation,
            is_hazard, provenance = prov_class, status = "current", version = VERSION) |>
  bind_rows(retired |> transmute(id = ID, iri = term_iri(ID), term = Term, facet = Facet, status = "deprecated",
                                 parent_id = successor, definition = paste("Retired:", reason), version = VERSION)) |>
  write_csv("dist/climate-taxonomy.csv", na = "")

tc <- read_csv("source/v4_to_v5_TERM_CHANGES.csv", show_col_types = FALSE)
sc <- read_csv("source/v4_to_v5_SYNONYM_CHANGES.csv", show_col_types = FALSE)
listed <- function(kind) tc |> filter(change == kind) |> transmute(line = glue("- `{ID}` {term} ({facet})")) |> pull(line)
write_lines(c(
  glue("# Changelog\n\n## {VERSION} ({TODAY})\n"),
  "First publication as a FAIR vocabulary (SKOS). Content is version 5 of the taxonomy, built 2026-09-04. Draft status.\n",
  "## Version 5 compared with version 4\n",
  glue("{nrow(concepts)} concepts (version 4 had 626). Changes recorded at term level:\n"),
  tc |> count(change) |> transmute(line = glue("- {change}: {n}")) |> pull(line),
  glue("\nSynonyms: {sum(sc$change == 'ADDED')} added, {sum(sc$change == 'REMOVED')} removed, {sum(sc$change == 'MOVED')} moved to another concept.\n"),
  "### Added concepts\n", listed("ADDED"), "\n### Retired concepts (identifiers kept, marked deprecated)\n", listed("RETIRED"),
  "\n### Renamed concepts\n", listed("RENAMED"),
  "\nFull detail: `source/v4_to_v5_TERM_CHANGES.csv` and `source/v4_to_v5_SYNONYM_CHANGES.csv`."
), "CHANGELOG.md")
cat("Wrote dist/climate-taxonomy.csv and CHANGELOG.md\n")

# 5. Pages: one per term, plus the landing page ---------------------------------------------------
h <- function(x) x |> str_replace_all("&", "&amp;") |> str_replace_all("<", "&lt;") |> str_replace_all(">", "&gt;")
link <- function(ids) if (length(ids)) paste0(glue('<a href="{ids}.html">{h(concepts$term[match(ids, concepts$id)])}</a>'), collapse = ", ") else "none"
CSS  <- read_file("docs/style.css")
PAGE <- read_file("templates/page.html")                       # the shell every page shares; <<...>> are filled by glue
page <- function(title, body, depth = "") glue(PAGE, .open = "<<", .close = ">>")

dir.create("docs/terms", showWarnings = FALSE, recursive = TRUE)
pwalk(concepts, function(id, term, synonyms, facet, parent_id, definition, source, urls, stage, scope, adaptation, condition, mitigation, m_condition, is_hazard, example, prov_class, provenance, ...) {
  rels <- relations |> filter(id == !!id)
  kids <- children$kids[match(id, children$parent_id)][[1]]
  rel_html <- paste0("<span class=k>", rels$type, "</span> ", map_chr(rels$target, link), collapse = "<br>")
  rows <- c(
    glue("<dt>Synonyms</dt><dd>{if (length(synonyms)) h(paste(synonyms, collapse = ', ')) else 'none'}</dd>"),
    glue("<dt>Broader</dt><dd>{if (is.na(parent_id)) 'Top concept of the scheme' else link(parent_id)}</dd>"),
    glue("<dt>Narrower</dt><dd>{link(kids)}</dd>"),
    if (nrow(rels)) glue("<dt>Relations</dt><dd>{rel_html}</dd>"),
    glue("<dt>Counts as adaptation</dt><dd>{if (adaptation == 'Adaptation-specific') 'Always (adaptation-specific).' else if (adaptation == 'Adaptation-conditional') h(condition) else 'Not an adaptation term.'}</dd>"),
    if (mitigation != "n/a") glue("<dt>Mitigation</dt><dd>{h(mitigation)}{if (mitigation == 'Mitigation-conditional') paste0(': ', h(m_condition)) else ''}</dd>"),
    if (nzchar(example)) glue("<dt>Example of use</dt><dd>{h(example)}</dd>"),
    glue("<dt>Provenance</dt><dd>{h(prov_class)}</dd>"),
    glue("<dt>Identifier</dt><dd><code>{id}</code> · <a href='{term_iri(id)}'>{term_iri(id)}</a><br><span class='src'>(planned permanent identifier: {future_iri(id)})</span></dd>")
  )
  body <- glue('<p class="eyebrow"><a href="../index.html#facet-{facets$slug[facets$facet == facet]}">{h(facet)}</a> · {h(stage)}</p>
<h1>{h(term)}</h1>
<p class="def">{h(definition)}</p><p class="src">Definition source: {h(source)}{if (length(urls)) paste0(" · ", paste(glue("<a href=\\"{urls}\\">reference</a>"), collapse = ", ")) else ""}</p>
<dl>{paste(rows, collapse = "\n")}</dl>
<script type="application/ld+json">{toJSON(list("@context" = context, "@graph" = list(concept_json(id, term, synonyms, facet, parent_id, definition, source, urls, stage, scope, adaptation, condition, mitigation, m_condition, is_hazard, example, prov_class, provenance))), auto_unbox = TRUE, null = "null")}</script>')
  write_file(page(term, body, "../"), glue("docs/terms/{id}.html"))
})
pwalk(retired, function(ID, Term, Facet, successor, reason) {
  body <- glue('<p class="eyebrow">{h(Facet)} · deprecated</p><h1>{h(Term)}</h1>
<p class="def">This term was retired in version 5 ({h(reason)}). The identifier <code>{ID}</code> is kept so that older reporting stays readable, and will never be reused.</p>
<dl><dt>Replaced by</dt><dd>{if (is.na(successor)) "No successor (concept dropped)" else link(successor)}</dd>
<dt>Identifier</dt><dd><code>{ID}</code> · <a href="{term_iri(ID)}">{term_iri(ID)}</a><br><span class="src">(planned permanent identifier: {future_iri(ID)})</span></dd></dl>')
  write_file(page(paste(Term, "(retired)"), body, "../"), glue("docs/terms/{ID}.html"))
})

fair_rows <- read_csv("source/fair_checklist.csv", show_col_types = FALSE)   # Cox et al. 2021, Table 1, with our status
browse <- pmap_chr(facets, \(facet, facet_def, slug) {
  ids <- concepts |> filter(facet == !!facet) |> arrange(level, term)
  glue('<details id="facet-{slug}"><summary>{h(facet)} <span class="n">{nrow(ids)}</span></summary><p class="src">{h(facet_def)}</p><p class="terms">{paste(glue("<a href=\\"terms/{ids$id}.html\\">{h(ids$term)}</a>"), collapse = " · ")}</p></details>')
})
fair_table <- paste0("<tr><td class=p>", fair_rows$principle, "</td><td>", h(fair_rows$test), "</td><td class=",
                     if_else(str_starts(fair_rows$status, "Yes"), "ok", "pend"), ">", h(fair_rows$status), "</td></tr>", collapse = "")
cite_doi   <- if (!nzchar(DOI)) "DOI to follow." else if (str_starts(DOI, "10.5072")) glue('Test DOI (Zenodo Sandbox, not resolvable outside it): <a href="https://sandbox.zenodo.org/records/{str_extract(DOI, "[0-9]+$")}">{DOI}</a>. A permanent DOI comes with the first non-draft release.') else glue('<a href="https://doi.org/{DOI}">doi:{DOI}</a>')
browse     <- paste(browse, collapse = "")
write_file(page(TITLE, glue(read_file("templates/index.html"), .open = "<<", .close = ">>")), "docs/index.html")
write_file(page("Method", glue(read_file("templates/method.html"), .open = "<<", .close = ">>")), "docs/method.html")
invisible(file.create("docs/.nojekyll"))
dir.create("docs/dist", showWarnings = FALSE)
file.copy(list.files("dist", full.names = TRUE), "docs/dist", overwrite = TRUE) |> invisible()
cat(glue("Wrote {nrow(concepts) + nrow(retired)} term pages and docs/index.html\n"))
