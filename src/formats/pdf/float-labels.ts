/**
 * @fileoverview The labels a figure or table caption opens with, in English and in the
 * languages journals print their own captions in, each in its Title-case and UPPER-case
 * form: the caption-label pattern, the label test page furniture spares, and the table test.
 * @module src/formats/pdf/float-labels
 */

/**
 * Table labels: English; German `Tab.` and `Tabelle`; Dutch, Afrikaans, and Indonesian
 * `Tabel`; French `Tableau`; Spanish `Tabla`; Portuguese `Tabela`; Italian `Tabella`.
 */
const TABLE_LABELS = ['Table', 'Tabelle', 'Tableau', 'Tabella', 'Tabela', 'Tabel', 'Tabla', 'Tab'];

/**
 * Figure labels: English `Figure`, `Fig.`, and their plurals; Dutch and Afrikaans `Figuur`;
 * German `Abb.` and `Abbildung`; Spanish, Portuguese, and Italian `Figura`; Indonesian `Gambar`.
 */
const FIGURE_LABELS = [
  'Figures',
  'Figure',
  'Figs',
  'Fig',
  'Figuur',
  'Abbildung',
  'Abb',
  'Figura',
  'Gambar',
];

/** Each label in its Title-case and UPPER-case forms, as a regex alternation. */
function forms(labels: string[]): string {
  return labels.flatMap((label) => [label, label.toUpperCase()]).join('|');
}

const TABLE = forms(TABLE_LABELS);
const FIGURE = forms(FIGURE_LABELS);

/** A caption's label at the start of a line: `Figure 3.`, `Fig. 2:`, `Table S1 |`, `TABEL 1`. */
export const CAPTION_START = new RegExp(
  `^((?:Supplementary\\s+|Extended\\s+Data\\s+)?(?:${FIGURE}|${TABLE}|Scheme|Chart|Box)\\.?\\s*S?\\d+[A-Za-z]?)\\s*(?:[.:|—–]\\s*|\\s+(?=\\p{Lu})|$)`,
  'u',
);

/** A figure or table label and its number opening a text: `Fig. 2`, `Tabla 1`. */
export const FLOAT_LABEL = new RegExp(`^(?:${FIGURE}|${TABLE})\\.?\\s*S?\\d`, 'u');

/** A table label and its number opening a text: `Table 3`, `Supplementary Table S1`, `Tab. 2`. */
export const TABLE_LABEL = new RegExp(
  `^(?:Supplementary\\s+|Extended\\s+Data\\s+)?(?:${TABLE})\\.?\\s*S?\\d`,
  'u',
);
