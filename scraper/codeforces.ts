import puppeteer from "puppeteer";

interface TestType {
	input: string;
	output: string;
}

interface DetailsType {
	title: string | undefined;
	timeLimit: string | undefined;
	memoryLimit: string | undefined;
	description: string | undefined;
	inputDescription: string | undefined;
	outputDescription: string | undefined;
	tests: TestType[] | undefined;
	status: number | undefined;
}

interface ErrorType {
	error: string;
	status: number;
}

// Add a type for the page.evaluate return value that can include error
interface PageEvaluateResult extends Partial<DetailsType> {
	error?: string;
}

async function scrapeCodeforcesProblem(
	id: string,
	ongoing: boolean,
): Promise<DetailsType | ErrorType> {
	try {
		const probSeturl = `https://codeforces.com/problemset/problem/${id.slice(0, -1)}/${id.slice(-1).toUpperCase()}`;
		const contestUrl = `https://codeforces.com/contest/${id.slice(0, -1)}/problem/${id.slice(-1).toUpperCase()}`;
		const url = ongoing ? contestUrl : probSeturl;
		const browser = await puppeteer.launch({
			headless: true,
			args: ["--no-sandbox", "--disable-setuid-sandbox"], // Required for many hosting platforms
		});
		const page = await browser.newPage();

		await page.setExtraHTTPHeaders({
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
		});

		await page.goto(url, { waitUntil: "domcontentloaded" });

		// Remove async from page.evaluate() - it's not supported
		const details: PageEvaluateResult = await page.evaluate(() => {
			console.log("inside evaluate");
			function wrapMathWithKatexDelimiters(html: string): string {
				console.log("inside wrap katex");
				const div = document.createElement("div");
				div.innerHTML = html;

				div.querySelectorAll(".tex-math").forEach((el) => {
					const latex = el.textContent?.trim() || "";
					// Use block math for centered formulas, inline otherwise
					const wrapper = document.createElement("span");
					wrapper.innerHTML = `\\(${latex}\\)`; // or use $$...$$ if it's block-level
					el.replaceWith(wrapper);
				});

				return div.innerHTML;
			}

			const problemStatement = document.querySelector(".problem-statement");
			if (!problemStatement) {
				return { error: "Problem statement not found" };
			}

			const titleElement = problemStatement.querySelector(".title");
			const timeLimitElement = problemStatement.querySelector(
				".header .time-limit",
			);
			const memoryLimitElement = problemStatement.querySelector(
				".header .memory-limit",
			);

			const rawDescription =
				problemStatement.children[1]?.innerHTML || "Description not found";
			const descriptionHTML = rawDescription;

			const inputDescriptionHTML =
				problemStatement.querySelector(".input-specification")?.innerHTML ||
				"Input description not found";
			const outputDescriptionHTML =
				problemStatement.querySelector(".output-specification")?.innerHTML ||
				"Output description not found";

			// Extract sample tests
			const sampleTestsNode = document.querySelector(".sample-tests");
			let tests: Array<{ input: string; output: string }> = [];

			const testNode = sampleTestsNode?.querySelector(".sample-test");
			if (testNode?.children && testNode?.children.length > 2) {
				return {
					error: "Depricated/Not Found",
				};
			}

			if (sampleTestsNode) {
				const inputNodes = sampleTestsNode.querySelectorAll(".input pre");
				const outputNodes = sampleTestsNode.querySelectorAll(".output pre");

				let inputMap = new Map<number, string[]>();
				let outputArray: string[] = [];

				// Extract and group input lines
				inputNodes.forEach((inputNode) => {
					const inputDivs = inputNode.querySelectorAll("div");

					inputDivs.forEach((div) => {
						let className = div.className;
						let match = className.match(/test-example-line-(\d+)/);
						if (!match) return;

						let testCaseIndex = parseInt(match[1], 10);
						if (testCaseIndex === 0) return; //Ignoring the 0th one cz its count

						let text = div.textContent?.trim();
						if (!inputMap.has(testCaseIndex)) {
							inputMap.set(testCaseIndex, []);
						}
						inputMap.get(testCaseIndex)?.push(text || "");
					});
				});

				// Extract output lines
				outputNodes.forEach((outputNode) => {
					let outputLines: string[] = [];
					outputLines = outputNode.textContent?.trim().split("\n") || [];
					outputArray.push(...outputLines);
				});

				// Construct test cases by aligning inputs and outputs
				let outputIndex = 0;
				inputMap.forEach((inputLines, testCaseIndex) => {
					let expectedOutput = outputArray[outputIndex] || "Output not found";
					tests.push({
						input: inputLines.join("\n"),
						output: expectedOutput,
					});
					outputIndex++;
				});
			}

			return {
				title: titleElement?.textContent?.trim(),
				timeLimit:
					timeLimitElement?.textContent?.slice(19).trim() ||
					"Time limit not found",
				memoryLimit:
					memoryLimitElement?.textContent?.slice(21).trim() ||
					"Memory limit not found",
				description: descriptionHTML,
				inputDescription: inputDescriptionHTML,
				outputDescription: outputDescriptionHTML,
				tests,
			};
		});

		await browser.close();

		if (details.error) {
			return { error: details.error, status: 404 };
		}

		const modDetails: DetailsType = {
			title: details.title,
			timeLimit: details.timeLimit,
			memoryLimit: details.memoryLimit,
			description: details.description,
			inputDescription: details.inputDescription,
			outputDescription: details.outputDescription,
			tests: details.tests,
			status: 200,
		};

		return modDetails;
	} catch (error) {
		console.error("Error:", error);
		return { error: JSON.stringify(error), status: 500 };
	}
}

export default scrapeCodeforcesProblem;
