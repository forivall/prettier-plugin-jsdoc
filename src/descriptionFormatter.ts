import { format } from "prettier";
import { TAGS_NEED_FORMAT_DESCRIPTION } from "./roles";
import { DESCRIPTION, EXAMPLE, TODO } from "./tags";
import { Comment } from "comment-parser";
import { JsdocOptions } from "./types";
import { capitalizer } from "./utils";

const EMPTY_LINE_SIGNATURE = "2@^5!~#sdE!_EMPTY_LINE_SIGNATURE";
const NEW_LINE_START_THREE_SPACE_SIGNATURE =
  "2@^5!~#sdE!_NEW_LINE_START_THREE_SPACE_SIGNATURE";
const NEW_LINE_START_WITH_DASH = "2@^5!~#sdE!_NEW_LINE_START_WITH_DASH";
const NEW_LINE_START_WITH_NUMBER = "2@^5!~#sdE!_NEW_LINE_START_WITH_NUMBER";
const NEW_PARAGRAPH_START_WITH_DASH =
  "2@^5!~#sdE!_NEW_PARAGRAPH_START_WITH_DASH";
const NEW_PARAGRAPH_START_THREE_SPACE_SIGNATURE =
  "2@^5!~#sdE!_NEW_PARAGRAPH_START_THREE_SPACE_SIGNATURE";
const CODE = "2@^5!~#sdE!_CODE";

interface DescriptionEndLineParams {
  description: string;
  tag: string;
  isEndTag: boolean;
}

function descriptionEndLine({
  description,
  tag,
  isEndTag,
}: DescriptionEndLineParams): string {
  if (description.trim().length < 0 || isEndTag) {
    return "";
  }

  if ([DESCRIPTION, EXAMPLE, TODO].includes(tag)) {
    return "\n";
  }

  return "";
}

/**
 * Trim, make single line with capitalized text. Insert dot if flag for it is
 * set to true and last character is a word character
 *
 * @private
 * @param {Boolean} insertDot Flag for dot at the end of text
 */
function formatDescription(
  tag: string,
  text: string,
  tagString: string,
  column: number,
  options: JsdocOptions,
): string {
  if (!TAGS_NEED_FORMAT_DESCRIPTION.includes(tag)) {
    return text;
  }

  if (!text) return text;

  /**
   * Description
   *
   * # Example
   *
   * Summry
   */
  text = text.replace(/[\n\s]+([#]+)(.*)[\n\s]+/g, "\n\n$1 $2\n\n");

  /**
   * 1. a thing
   *
   * 2. another thing
   */
  text = text.replace(/^(\d+)[-.][\s-.|]+/g, "$1. "); // Start
  text = text.replace(
    /[\n\s]+(\d+)[-.][\s-.|]+/g,
    NEW_LINE_START_WITH_NUMBER + "$1. ",
  );

  const codes = text.match(/```((?!(```)).*\n)+```/g);

  if (codes) {
    codes.forEach((code) => {
      text = text.replace(code, `\n\n${CODE}\n\n`);
    });
  }

  text = text.replace(
    /(\n\n\s\s\s+)|(\n\s+\n\s\s\s+)/g,
    NEW_PARAGRAPH_START_THREE_SPACE_SIGNATURE,
  ); // Add a signature for new paragraph start with three space

  text = text.replace(
    /(\n\n+(\s+|)-(\s+|))/g, // `\n\n - ` | `\n\n-` | `\n\n -` | `\n\n- `
    NEW_PARAGRAPH_START_WITH_DASH,
  );

  text = text.replace(
    /(\n(\s+|)-(\s+|))/g, // `\n - ` | `\n-` | `\n -` | `\n- `
    NEW_LINE_START_WITH_DASH,
  );

  text = text.replace(/(\n\n)|(\n\s+\n)/g, EMPTY_LINE_SIGNATURE); // Add a signature for empty line and use that later
  text = text.replace(/\n\s\s\s+/g, NEW_LINE_START_THREE_SPACE_SIGNATURE); // Add a signature for new line start with three space

  text = capitalizer(text);

  text = `${"_".repeat(tagString.length)}${text}`;

  const { printWidth = 80 } = options;

  // Wrap tag description
  const beginningSpace = tag === DESCRIPTION ? "" : "    "; // google style guide space
  const marginLength = tagString.length;
  let maxWidth = printWidth - column - 3; // column is location of comment, 3 is ` * `

  if (marginLength >= maxWidth) {
    maxWidth = marginLength;
  }

  text = text = text
    .split(NEW_PARAGRAPH_START_THREE_SPACE_SIGNATURE)
    .map((newParagraph) => {
      return newParagraph
        .split(EMPTY_LINE_SIGNATURE)
        .map(
          (newEmptyLineWithDash) =>
            newEmptyLineWithDash
              .split(NEW_LINE_START_WITH_NUMBER)
              .map(
                (newLineWithNumber) =>
                  newLineWithNumber
                    .split(NEW_PARAGRAPH_START_WITH_DASH)
                    .map(
                      (newLineWithDash) =>
                        newLineWithDash
                          .split(NEW_LINE_START_WITH_DASH)
                          .map((paragraph) => {
                            paragraph = paragraph.replace(/[\n\s]+/g, " "); // Make single line

                            paragraph = capitalizer(paragraph);
                            if (options.jsdocDescriptionWithDot)
                              paragraph = paragraph.replace(
                                /(\w)(?=$)/g,
                                "$1.",
                              ); // Insert dot if needed

                            return paragraph
                              .split(NEW_LINE_START_THREE_SPACE_SIGNATURE)
                              .map((value) =>
                                breakDescriptionToLines(
                                  value,
                                  maxWidth,
                                  beginningSpace,
                                ),
                              )
                              .join("\n    "); // NEW_LINE_START_THREE_SPACE_SIGNATURE
                          })
                          .join("\n- "), // NEW_LINE_START_WITH_DASH
                    )
                    .join("\n\n- "), // NEW_PARAGRAPH_START_WITH_DASH
              )
              .join("\n"), // NEW_LINE_START_WITH_NUMBER
        )
        .join("\n\n"); // EMPTY_LINE_SIGNATURE
    })
    .join("\n\n    "); // NEW_PARAGRAPH_START_THREE_SPACE_SIGNATURE;

  if (codes) {
    text = text.split(CODE).reduce((pre, cur, index) => {
      return `${pre}${cur}${codes[index] ?? ""}`;
    }, "");
  }

  text = text.replace(/^_+/g, "");

  const isAddedFakeDash = !text.startsWith("- ") && tag !== DESCRIPTION;
  if (isAddedFakeDash) {
    text = `- ${text}`;
  }

  try {
    text = format(text, {
      ...options,
      parser: "markdown",
      printWidth: printWidth - column,
    }).trim();
  } catch (e) {
    if (process.env.NODE_ENV === "test") {
      console.log(e);
    }
  }

  if (isAddedFakeDash) {
    text = text.replace("- ", "");
  }

  return text || "";
}

function breakDescriptionToLines(
  desContent: string,
  maxWidth: number,
  beginningSpace: string,
) {
  let str = desContent.trim();

  if (!str) {
    return str;
  }
  const extraLastLineWidth = 10;
  let result = "";
  while (str.length > maxWidth + extraLastLineWidth) {
    let sliceIndex = str.lastIndexOf(" ", maxWidth);
    /**
     * When a str is a long word lastIndexOf will gives 4 every time loop
     * running on limited time
     */
    if (sliceIndex <= beginningSpace.length)
      sliceIndex = str.indexOf(" ", beginningSpace.length + 1);

    if (sliceIndex === -1) sliceIndex = str.length;

    result += str.substring(0, sliceIndex);
    str = str.substring(sliceIndex + 1);

    str = `${beginningSpace}${str}`;
    str = `\n${str}`;
  }

  result += str;

  return result;
}

function convertCommentDescToDescTag(parsed: Comment): void {
  if (!parsed.description) {
    return;
  }

  const Tag = parsed.tags.find(({ tag }) => tag.toLowerCase() === DESCRIPTION);
  let { description = "" } = Tag || {};

  description += parsed.description;

  if (Tag) {
    Tag.description = description;
  } else {
    parsed.tags.push({ tag: DESCRIPTION, description } as any);
  }
}

export {
  EMPTY_LINE_SIGNATURE,
  NEW_LINE_START_WITH_DASH,
  NEW_PARAGRAPH_START_WITH_DASH,
  NEW_LINE_START_THREE_SPACE_SIGNATURE,
  NEW_PARAGRAPH_START_THREE_SPACE_SIGNATURE,
  descriptionEndLine,
  convertCommentDescToDescTag,
  formatDescription,
};
