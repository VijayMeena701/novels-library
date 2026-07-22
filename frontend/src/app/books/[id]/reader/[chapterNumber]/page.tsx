"use client";

import { cn } from "../../../../../lib/utils";
import { use, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { type SourceKind } from "../../../../../utils/api";
import { useAuth } from "../../../../../context/AuthContext";
import { CAPABILITY } from "../../../../../utils/permissions";
import { applyReaderThemeCssVariables } from "../../../../../lib/reader-theme";
import { type ReaderPanelTab } from "../../../../../lib/reader-utils";
import { SpeechWidget } from "../../../../../components/reader/SpeechWidget";
import { ReaderBottomToolbar } from "../../../../../components/reader/ReaderBottomToolbar";
import { ReaderControlBar } from "../../../../../components/reader/ReaderControlBar";
import { ReaderCatalog } from "../../../../../components/reader/ReaderCatalog";
import { PronunciationRulesModal } from "../../../../../components/reader/PronunciationRulesModal";
import { ReaderHeader } from "../../../../../components/reader/ReaderHeader";
import { ReaderChapterHeader } from "../../../../../components/reader/ReaderChapterHeader";
import { ReaderChapterContent } from "../../../../../components/reader/ReaderChapterContent";
import { ReaderErrorState } from "../../../../../components/reader/ReaderErrorState";
import { Spinner } from "../../../../../components/ui/spinner";
import { useReaderSettings } from "../../../../../hooks/useReaderSettings";
import { useReaderTts } from "../../../../../hooks/useReaderTts";
import { usePronunciationRules } from "../../../../../hooks/usePronunciationRules";
import { useChapterData } from "../../../../../hooks/useChapterData";
import { useReaderCatalog } from "../../../../../hooks/useReaderCatalog";
import { useReaderNavigation } from "../../../../../hooks/useReaderNavigation";
import { useReaderAdminActions } from "../../../../../hooks/useReaderAdminActions";

export default function ReaderView({
	params,
}: {
	params: Promise<{ id: string; chapterNumber: string }> | { id: string; chapterNumber: string };
}) {
	const resolvedParams = params instanceof Promise ? use(params) : params;
	const { id: bookId, chapterNumber: chNumStr } = resolvedParams;

	const searchParams = useSearchParams();
	const { user, loading: authLoading, hasCapability } = useAuth();

	const chapterNumber = parseInt(chNumStr, 10);
	const shouldResumeTtsFromRoute = searchParams.get("tts") === "1";
	const readingSource: SourceKind = searchParams.get("source") === "raw" ? "raw" : "translated";
	const isRawReader = readingSource === "raw";

	const readerContentRef = useRef<HTMLDivElement | null>(null);

	const settings = useReaderSettings(user);
	const chapterData = useChapterData({ bookId, chapterNumber, isRawReader, user });
	const pronunciation = usePronunciationRules(bookId, user);
	const catalog = useReaderCatalog({
		isRawReader,
		book: chapterData.book,
		chapters: chapterData.chapters,
		chapter: chapterData.chapter,
		chapterNumber,
	});
	const navigation = useReaderNavigation({ bookId, chapterNumber, readingSource });

	const tts = useReaderTts({
		readerContentRef,
		chapter: chapterData.chapter,
		chapterNumber,
		hasNextChapter: catalog.hasNextChapter,
		nextChapterNumber: catalog.nextChapterNumber,
		navigateToChapter: navigation.navigateToChapter,
		autoOpenNext: settings.autoOpenNext,
		rate: settings.rate,
		pitch: settings.pitch,
		voiceURI: settings.voiceURI,
		speechConfigRef: settings.speechConfigRef,
		pronunciationRules: pronunciation.rules,
		availableVoices: settings.voices,
		highlightParagraph: settings.highlightParagraph,
		paragraphHighlightColor: settings.paragraphColor,
		autoScrollDuringSpeech: settings.autoScrollDuringSpeech,
		autoScrollOffset: settings.autoScrollOffset,
		autoScrollBehavior: settings.autoScrollBehavior,
		wordHighlightColor: settings.wordColor,
		highlightMode: settings.highlightMode,
		shouldResumeTtsFromRoute,
		loading: chapterData.loading,
		readerSettingsReady: settings.readerSettingsReady,
		authLoading,
		speechSupported: settings.speechSupported,
	});

	const admin = useReaderAdminActions({
		bookId,
		book: chapterData.book,
		chapter: chapterData.chapter,
		chapterNumber,
		readerSourceKind: catalog.readerSourceKind,
		archiveJobType: catalog.archiveJobType,
		currentSourceUrl: catalog.currentSourceUrl,
		setBook: chapterData.setBook,
		setError: chapterData.setError,
		reloadCurrentChapter: chapterData.reloadCurrentChapter,
	});

	const [isReaderPanelOpen, setIsReaderPanelOpen] = useState(false);
	const [readerPanelTab, setReaderPanelTab] = useState<ReaderPanelTab>("read");
	const [isCatalogOpen, setIsCatalogOpen] = useState(false);
	const [isPronunciationModalOpen, setIsPronunciationModalOpen] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;
		window.scrollTo({ top: 0, behavior: "auto" });
	}, [chapterNumber, tts.stop]);

	const readerThemeStyle = useMemo(() => applyReaderThemeCssVariables(settings.theme) as CSSProperties, [settings.theme]);
	const isSerif = settings.theme !== "paper";
	const widthStyle = useMemo(
		() =>
			({
				narrow: "640px",
				medium: "900px",
				wide: "1280px",
			}[settings.readWidth]),
		[settings.readWidth],
	);
	const totalChapters = isRawReader
		? chapterData.book?.rawChaptersTotal ?? 0
		: chapterData.book?.translatedChaptersTotal ?? 0;
	const readingTimeMinutes = chapterData.chapter?.content
		? Math.max(1, Math.ceil(chapterData.chapter.content.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length / 250))
		: 0;

	if (chapterData.loading || authLoading || !settings.readerSettingsReady) {
		return (
			<div className="reader-theme flex min-h-screen flex-col items-center justify-center bg-[var(--reader-bg)] text-[var(--reader-text)]">
				<Spinner size="lg" />
			</div>
		);
	}

	const openSettingsDisplay = () => {
		setReaderPanelTab("display");
		setIsReaderPanelOpen(true);
	};

	const openSettingsSpeech = () => {
		setReaderPanelTab("speech");
		setIsReaderPanelOpen(true);
	};

	const handleOpenCatalog = () => setIsCatalogOpen(true);
	const handleCloseCatalog = () => setIsCatalogOpen(false);
	const handleOpenPronunciationRules = () => setIsPronunciationModalOpen(true);
	const handleClosePronunciationRules = () => setIsPronunciationModalOpen(false);

	const commonHeader = (
		<ReaderHeader
			bookId={bookId}
			bookTitle={chapterData.book?.title ?? ""}
			catalogLength={catalog.catalogItems.length}
			onOpenCatalog={handleOpenCatalog}
			onOpenSettings={openSettingsDisplay}
		/>
	);

	const commonCatalog = (
		<ReaderCatalog
			isOpen={isCatalogOpen}
			onClose={handleCloseCatalog}
			items={catalog.catalogItems}
			currentChapterNumber={chapterNumber}
			onSelectChapter={navigation.navigateToChapter}
			isRawReader={isRawReader}
			archivedCount={chapterData.chapters.length}
		/>
	);

	const readerError = chapterData.error || !chapterData.chapter || !chapterData.book;

	if (readerError) {
		return (
			<div
				className={cn(
					"reader-theme relative flex min-h-screen flex-col bg-[var(--reader-bg)] text-[var(--reader-text)]",
					isSerif ? "font-serif" : "font-sans",
				)}
				style={readerThemeStyle}
			>
				{commonHeader}
				{commonCatalog}
				<ReaderErrorState
					bookId={bookId}
					book={chapterData.book}
					chapterNumber={chapterNumber}
					isRawReader={isRawReader}
					error={chapterData.error}
					missingChapterTitle={catalog.missingChapterTitle}
					currentSourceUrl={catalog.currentSourceUrl}
					currentCatalogItem={catalog.currentCatalogItem}
					adminActionMessage={admin.adminActionMessage}
					adminScrapingChapter={admin.adminScrapingChapter}
					chapterHtmlPageUrl={admin.chapterHtmlPageUrl}
					chapterHtmlContent={admin.chapterHtmlContent}
					importingChapterHtml={admin.importingChapterHtml}
					readerSourceKind={catalog.readerSourceKind}
					canScrape={hasCapability(CAPABILITY.JOBS_SCRAPE)}
					onScrape={admin.handleScrapeCurrentChapterNow}
					onImport={admin.handleImportCurrentChapterHtml}
					onPageUrlChange={admin.setChapterHtmlPageUrl}
					onContentChange={admin.setChapterHtmlContent}
				/>
			</div>
		);
	}

	const book = chapterData.book!;
	const chapter = chapterData.chapter!;

	return (
		<>
			<div
				className={cn(
					"reader-theme relative flex min-h-screen flex-col bg-[var(--reader-bg)] text-[var(--reader-text)]",
					isSerif ? "font-serif" : "font-sans",
				)}
				style={readerThemeStyle}
			>
				{commonHeader}
				{commonCatalog}

				<main className="flex flex-1 justify-center px-5 py-12 pb-40 max-[860px]:px-4 max-[860px]:py-8 max-[860px]:pb-32">
					<article
						className="flex w-full flex-col gap-8 leading-[1.9] text-[var(--reader-text)]"
						style={{ maxWidth: widthStyle }}
					>
						<ReaderChapterHeader
							book={book}
							chapter={chapter}
							displayChapterTitle={catalog.displayChapterTitle}
							isRawReader={isRawReader}
							translatingRawChapter={admin.translatingRawChapter}
							onGenerateTranslation={admin.handleGenerateTranslation}
							canTranslate={hasCapability(CAPABILITY.CHAPTERS_TRANSLATE)}
						/>
						<ReaderChapterContent
							ref={readerContentRef}
							content={chapter.content}
							fontSize={settings.fontSize}
							onClick={(startBlockIndex) =>
								tts.startSpeechFromBlock(startBlockIndex, {
									continueAcrossChapters: settings.autoOpenNext,
									fromUserGesture: true,
								})
							}
						/>
					</article>
				</main>

				<SpeechWidget
					supported={settings.speechSupported}
					status={tts.ttsStatus}
					error={tts.speechError}
					onPlay={tts.play}
					onPause={tts.pause}
					onStop={() => tts.stop()}
					onPrevChapter={() => navigation.navigateToChapter(catalog.previousChapterNumber)}
					onNextChapter={() => navigation.navigateToChapter(catalog.nextChapterNumber)}
					hasPrevChapter={catalog.hasPreviousChapter}
					hasNextChapter={catalog.hasNextChapter}
					voices={settings.voices}
					voiceURI={settings.voiceURI}
					onVoiceChange={settings.onVoiceChange}
					position={settings.speechPortalPosition}
					onPositionChange={settings.onPositionChange}
					togglePosition={settings.speechTogglePosition}
					onTogglePositionChange={settings.onTogglePositionChange}
					onOpenSettings={openSettingsSpeech}
					isBottomToolbarOpen={isReaderPanelOpen}
				/>

				<ReaderBottomToolbar
					isOpen={isReaderPanelOpen}
					onOpenChange={setIsReaderPanelOpen}
					activeTab={readerPanelTab}
					onTabChange={setReaderPanelTab}
					onPreviousChapter={() => navigation.navigateToChapter(catalog.previousChapterNumber)}
					onNextChapter={() => navigation.navigateToChapter(catalog.nextChapterNumber)}
					onOpenCatalog={handleOpenCatalog}
					hasPreviousChapter={catalog.hasPreviousChapter}
					hasNextChapter={catalog.hasNextChapter}
					previousChapterNumber={catalog.previousChapterNumber}
					nextChapterNumber={catalog.nextChapterNumber}
					catalogItemsLength={catalog.catalogItems.length}
					bookId={bookId}
					bookTitle={book.title}
					theme={settings.theme}
					onThemeChange={settings.onThemeChange}
					fontSize={settings.fontSize}
					onFontSizeDecrease={settings.onFontSizeDecrease}
					onFontSizeIncrease={settings.onFontSizeIncrease}
					readWidth={settings.readWidth}
					onReadWidthChange={settings.onReadWidthChange}
					voices={settings.voices}
					voiceURI={settings.voiceURI}
					onVoiceChange={settings.onVoiceChange}
					rate={settings.rate}
					onRateChange={settings.onRateChange}
					pitch={settings.pitch}
					onPitchChange={settings.onPitchChange}
					highlightMode={settings.highlightMode}
					onHighlightModeChange={settings.onHighlightModeChange}
					highlightParagraph={settings.highlightParagraph}
					onHighlightParagraphChange={settings.onHighlightParagraphChange}
					paragraphColor={settings.paragraphColor}
					onParagraphColorChange={settings.onParagraphColorChange}
					wordColor={settings.wordColor}
					onWordColorChange={settings.onWordColorChange}
					sentenceHighlightOpacity={settings.sentenceHighlightOpacity}
					onSentenceHighlightOpacityChange={settings.onSentenceHighlightOpacityChange}
					autoScrollDuringSpeech={settings.autoScrollDuringSpeech}
					onAutoScrollDuringSpeechChange={settings.onAutoScrollDuringSpeechChange}
					autoScrollBehavior={settings.autoScrollBehavior}
					onAutoScrollBehaviorChange={settings.onAutoScrollBehaviorChange}
					autoScrollOffset={settings.autoScrollOffset}
					onAutoScrollOffsetChange={settings.onAutoScrollOffsetChange}
					autoOpenNext={settings.autoOpenNext}
					onAutoOpenNextChange={settings.onAutoOpenNextChange}
					pronunciationRulesEnabled={!!user}
					onOpenPronunciationRules={handleOpenPronunciationRules}
					isRawReader={isRawReader}
					readerSourceKind={catalog.readerSourceKind}
					switchReaderSource={navigation.switchReaderSource}
					hasRawChapters={(book.rawChaptersTotal ?? 0) > 0}
					sourceUrl={chapter.sourceUrl}
					onScrollToTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
					isLoggedIn={!!user}
				/>

				<ReaderControlBar
					chapterNumber={chapter.chapterNumber}
					totalChapters={totalChapters || catalog.catalogItems.length}
					hasPreviousChapter={catalog.hasPreviousChapter}
					hasNextChapter={catalog.hasNextChapter}
					onPreviousChapter={() => navigation.navigateToChapter(catalog.previousChapterNumber)}
					onNextChapter={() => navigation.navigateToChapter(catalog.nextChapterNumber)}
					onPlay={tts.play}
					onPause={tts.pause}
					speechStatus={tts.ttsStatus}
					readingTimeMinutes={readingTimeMinutes}
				/>

				<PronunciationRulesModal
					open={isPronunciationModalOpen}
					onClose={handleClosePronunciationRules}
					bookTitle={book.title || ""}
					rules={pronunciation.rules}
					loading={pronunciation.loading}
					error={pronunciation.error}
					onCreate={pronunciation.create}
					onUpdate={pronunciation.update}
					onDelete={pronunciation.remove}
				/>
			</div>
		</>
	);
}
