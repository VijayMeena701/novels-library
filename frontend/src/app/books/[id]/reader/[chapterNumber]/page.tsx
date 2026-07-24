import ReaderView from "./ReaderView";

interface ReaderPageParams {
id: string;
chapterNumber: string;
}

interface ReaderPageProps {
params: Promise<ReaderPageParams> | ReaderPageParams;
}

export default async function ReaderPage({ params }: ReaderPageProps) {
const resolved = await (params as Promise<ReaderPageParams>);
const { id, chapterNumber: chapterNumberStr } = resolved;
const chapterNumber = parseInt(chapterNumberStr, 10);

return <ReaderView id={id} chapterNumber={chapterNumber} />;
}
