import express, { Request, Response } from "express";
import scrapeCodeforcesProblem from "./scraper/codeforces";
import cors from "cors";

const app = express();
const corsOptions = {
	origin: [],
};
app.use(cors(corsOptions));
app.use(express.json());

app.get("/cf", async function (req, res) {
	const id = req.query.id as string;
	const ongoing = req.query.ongoing === "true";

	try {
		const data = await scrapeCodeforcesProblem(id, ongoing);

		// Type guard to check if data has status property (DetailsType) vs error property (ErrorType)
		if ("status" in data && data.status === 200) {
			res.status(200).json(data);
		} else if ("error" in data) {
			res.status(data.status || 500).json({ error: data.error });
		} else {
			res.status(500).json({ error: "Unknown error occurred" });
		}
	} catch (error) {
		res.status(500).json({ error: String(error) });
	}
});

app.listen(3001, () => {
	console.log("listening on 3001");
});

export default app;
