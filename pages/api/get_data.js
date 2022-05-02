import { getData } from "../../lib/data_fetcher";

export default async function (req, res) {
    const data = await getData(req.query.company, req.query.start, req.query.end, `interval=${req.query.interval}`)
    res.status(200).json(data);
}