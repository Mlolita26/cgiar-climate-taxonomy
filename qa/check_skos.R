# qa/check_skos.R
# Checks the built vocabulary. Structural checks run on the data (tidyverse only); if the rdflib
# package is installed, the Turtle and JSON-LD files are also parsed back and queried.
# Run from the repository root:   Rscript qa/check_skos.R

library(dplyr); library(purrr); library(readr); library(stringr); library(jsonlite)

raw      <- read_json("source/taxonomy_v6.json")
fix      <- read_csv("source/id_corrections.csv", show_col_types = FALSE)
ids      <- map_chr(raw$concepts, "id")
parents  <- map_chr(raw$concepts, "parent_id", .default = NA_character_)
labels   <- map_chr(raw$concepts, "term")
defs     <- map_chr(raw$concepts, "definition", .default = "")
synonyms <- map(raw$concepts, \(c) as.character(unlist(c$synonyms)))
facets   <- map_chr(raw$concepts, "facet")
targets  <- unlist(map(raw$concepts, \(c) map_chr(c$relations, "target")))
retired  <- bind_rows(read_csv("source/v5_retired_ids.csv", show_col_types = FALSE), read_csv("source/v6_retired_ids.csv", show_col_types = FALSE))
retired  <- bind_rows(retired, fix |> filter(!id_in_master %in% retired$ID) |> transmute(ID = id_in_master, Term = previous_term, successor = previous_successor))
recode   <- function(x) { i <- match(x, fix$id_in_master); ifelse(is.na(i), x, fix$published_id[i]) }   # same correction as the build
ids <- recode(ids); parents <- recode(parents); targets <- recode(targets)
dangling <- setdiff(targets, ids)                    # relation targets missing from the master; the build leaves these relations out

# An identifier must not change when its term moves, also to another facet (GOVERNANCE.md, rule of 2026-11-20).
# A retired id whose successor carries the same label is such a move. The moves recorded in versions 5 and 6
# were published before the rule and stay as published; one in any later file of retired ids fails the check.
ret_files <- list.files("source", "^v[0-9]+_retired_ids\\.csv$", full.names = TRUE)
moves <- map_dfr(ret_files, \(f) read_csv(f, col_types = cols(.default = "c")) |> mutate(file = basename(f))) |>
  mutate(succ = str_extract(successor, "[A-Z]{2,4}_[0-9]+"), succ_label = labels[match(succ, ids)]) |>
  filter(!is.na(succ_label), str_to_lower(succ_label) == str_to_lower(Term))
moves_after_rule <- moves |> filter(!file %in% c("v5_retired_ids.csv", "v6_retired_ids.csv"))
csv_out <- read_csv("dist/climate-taxonomy.csv", col_types = cols(.default = "c"))
site    <- c("index", "browse", "downloads", "releases", "contribute", "about", "tools", "method")

# walk up the parent chain from every concept; a cycle would never reach a top concept
depth <- function(id, seen = character()) {
  if (id %in% seen) return(NA_integer_)
  p <- parents[match(id, ids)]
  if (is.na(p)) return(length(seen)) else depth(p, c(seen, id))
}

checks <- tribble(
  ~check,                                                   ~ok,
  "no published id is reused: every corrected id is new, every reused id is retired",
                                                             !any(fix$published_id %in% retired$ID) && all(fix$id_in_master %in% retired$ID) && !any(fix$id_in_master %in% ids),
  "768 concepts",                                            length(ids) == 768,
  "ids are unique",                                          !anyDuplicated(ids),
  "every concept has a label",                               all(nzchar(labels)),
  "every concept has a definition",                          all(nzchar(defs)),
  "every parent exists",                                     all(parents[!is.na(parents)] %in% ids),
  "no parent is a retired id",                               !any(parents %in% retired$ID),
  "no cycles in the hierarchy",                              !any(is.na(map_int(ids, depth))),
  sprintf("relations to missing concepts are left out of the vocabulary (%s)", if (length(dangling)) paste(dangling, collapse = ", ") else "none"),
                                                             !any(str_detect(read_file("dist/climate-taxonomy.ttl"), paste0("ct:", dangling, "\b"))) | !length(dangling),
  "every retired id's successor, where named, exists",       all(is.na(str_extract(retired$successor, "[A-Z]{2,4}_[0-9]+")) | str_extract(retired$successor, "[A-Z]{2,4}_[0-9]+") %in% ids),
  "no retired id is also a current id",                      !any(retired$ID %in% ids),
  "no synonym duplicates another concept's label",           !any(str_to_lower(unlist(synonyms)) %in% str_to_lower(labels)),
  "every concept belongs to one of 11 facets",               n_distinct(facets) == 11,
  "dist files exist",                                        all(file.exists(c("dist/climate-taxonomy.ttl", "dist/climate-taxonomy.jsonld", "dist/climate-taxonomy.csv", "dist/meliaf-relations.ttl"))),
  "one page per concept and per retired id",                 all(file.exists(sprintf("docs/terms/%s.html", c(ids, retired$ID)))),
  sprintf("no identifier changed for a move (%d moves of versions 5 and 6, made before the rule, stay as published)", nrow(moves)),
                                                             nrow(moves_after_rule) == 0,
  "every current concept has a review status",               all(nzchar(csv_out$review_status[csv_out$status == "current"]) & !is.na(csv_out$review_status[csv_out$status == "current"])),
  "the site pages, the search data, the stylesheet and the script exist",
                                                             all(file.exists(c(sprintf("docs/%s.html", site), "docs/data/terms.json", "docs/style.css", "docs/site.js"))),
  "the search data holds every current and retired id",      setequal(c(map_chr(read_json("docs/data/terms.json")$concepts, "id"), map_chr(read_json("docs/data/terms.json")$retired, "id")), c(ids, retired$ID))
)

# JSON-LD: parse and count with jsonlite (always possible)
jl <- read_json("dist/climate-taxonomy.jsonld")
types <- map_chr(jl$`@graph`, \(n) n$type %||% n$`@type` %||% "")
checks <- add_row(checks, check = "JSON-LD parses and has 768 current + retired concepts",
                  ok = sum(types == "skos:Concept") == 768 + nrow(retired))

# Turtle: parse back with rdflib if available
if (requireNamespace("rdflib", quietly = TRUE)) {
  # plain SPARQL 1.0 patterns (the bundled engine has no COUNT or NOT EXISTS); counting is done in R
  SKOS <- "<http://www.w3.org/2004/02/skos/core#"
  g        <- rdflib::rdf_parse("dist/climate-taxonomy.ttl", format = "turtle")
  concepts <- rdflib::rdf_query(g, paste0("SELECT ?c WHERE { ?c a ", SKOS, "Concept> }"))
  broader  <- rdflib::rdf_query(g, paste0("SELECT ?s ?o WHERE { ?s ", SKOS, "broader> ?o }"))
  scheme   <- rdflib::rdf_query(g, paste0("SELECT ?t ?l ?v WHERE { ?s a ", SKOS, "ConceptScheme> ; <http://purl.org/dc/terms/title> ?t ; <http://purl.org/dc/terms/license> ?l ; <http://www.w3.org/2002/07/owl#versionInfo> ?v }"))
  checks <- checks |>
    add_row(check = "Turtle parses (rdflib)", ok = TRUE) |>
    add_row(check = "Turtle has 768 current + retired concepts", ok = n_distinct(concepts$c) == 768 + nrow(retired)) |>
    add_row(check = "every skos:broader points to a concept", ok = all(broader$o %in% concepts$c)) |>
    add_row(check = "scheme carries title, licence and version", ok = nrow(scheme) == 1)
} else {
  checks <- add_row(checks, check = "Turtle parse skipped: install.packages('rdflib') to enable", ok = NA)
}

report <- checks |> mutate(result = case_when(is.na(ok) ~ "SKIPPED", ok ~ "ok", TRUE ~ "FAIL"))
dir.create("qa", showWarnings = FALSE)
write_lines(c(format(Sys.time()), sprintf("%-8s %s", report$result, report$check)), "qa/report.txt")
cat(sprintf("%-8s %s\n", report$result, report$check), sep = "")
if (any(report$result == "FAIL")) stop("QA failed: see qa/report.txt") else cat("QA passed\n")
