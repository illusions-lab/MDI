export const MDI_STYLESHEET = `.mdi-em {
  text-emphasis: var(--mdi-em, "﹅");
  -webkit-text-emphasis: var(--mdi-em, "﹅");
  text-emphasis-position: over right;
}
.mdi-em rt {
  text-emphasis: none;
}
.mdi-nobr {
  white-space: nowrap;
  word-break: keep-all;
}
.mdi-blank {
  min-block-size: 1lh; /* an empty <p> otherwise collapses to zero height */
}
.mdi-warichu {
  display: inline-block;
  font-size: 0.5em;
  line-height: 1.1;
  max-inline-size: 10em;
  vertical-align: middle;
  text-align: start;
}
.mdi-kern {
  letter-spacing: var(--mdi-kern, 0em);
}
.mdi-indent {
  margin-inline-start: calc(var(--mdi-indent, 0) * 1em);
}
.mdi-bottom {
  text-align: end;
  margin-inline-end: calc(var(--mdi-shift, 0) * 1em);
}
.mdi-pagebreak       { break-after: page; }
.mdi-pagebreak-right { break-after: recto; }
.mdi-pagebreak-left  { break-after: verso; }
`;
