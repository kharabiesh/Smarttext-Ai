import { beforeEach, describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "@/App";
import { MemoryStore } from "@/lib/db/memoryStore";
import { setStoreForTests } from "@/lib/db";
import { setTransportForTests } from "@/state/ai";
import { useNav } from "@/state/nav";
import { DEFAULT_SETTINGS, useSettings } from "@/state/settings";
import { useChat } from "@/state/chat";
import { HumanizerPage } from "@/pages/Humanizer";
import { ImagePage } from "@/pages/ImageGenerator";
import { AnalysisPage } from "@/pages/TextAnalysis";
import { mockTransport, openAiChat } from "./helpers";

let store: MemoryStore;
beforeEach(async () => {
  store = new MemoryStore();
  setStoreForTests(store);
  await useSettings.getState().init(store);
  useSettings.setState({ settings: { ...DEFAULT_SETTINGS }, keyStatus: { openai: true, anthropic: false, openai_compatible: false } });
  useNav.setState({ page: "dashboard", payload: null });
  useChat.setState({ conversations: [], activeId: null, pending: false, error: null, loaded: false });
});

describe("App shell", () => {
  it("renders the sidebar and switches to Arabic RTL layout", async () => {
    render(<App />);
    expect(await screen.findByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("ltr");
    act(() => useSettings.getState().update({ language: "ar" }));
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(document.documentElement.lang).toBe("ar");
    expect(screen.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "لوحة التحكم" })).toHaveAttribute("aria-current", "page");
  });

  it("applies the dark theme", async () => {
    render(<App />);
    act(() => useSettings.getState().update({ theme: "dark" }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe("dark"));
  });

  it("navigates with Ctrl+number shortcuts", async () => {
    render(<App />);
    await screen.findByRole("navigation", { name: "Main navigation" });
    await userEvent.keyboard("{Control>}2{/Control}");
    expect(useNav.getState().page).toBe("humanizer");
  });

  it("shows the developer credit on the About page", async () => {
    useNav.setState({ page: "about" });
    render(<App />);
    expect(await screen.findByTestId("developer-credit")).toHaveTextContent("Ismaiel Almarie");
  });
});

describe("Humanizer workflow (MOCK provider)", () => {
  it("rewrites text, shows counts, highlights changes and saves history", async () => {
    const m = mockTransport([openAiChat("The fast brown fox jumps.")]);
    setTransportForTests(m.transport);
    const user = userEvent.setup();
    render(<HumanizerPage />);
    await user.type(screen.getByRole("textbox", { name: "Original text" }), "The quick brown fox jumps.");
    expect(screen.getAllByText(/5 words/)[0]).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Academic" }));
    await user.click(screen.getByRole("button", { name: /Improve text/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Revised text" })).toHaveValue("The fast brown fox jumps."));
    const sent = m.calls[0].body as { messages: Array<{ role: string; content: string }> };
    expect(sent.messages[0].content).toMatch(/academic/);
    expect(sent.messages[1].content).toBe("The quick brown fox jumps.");
    await user.click(screen.getByRole("radio", { name: "Highlight changes" }));
    const diff = screen.getByTestId("diff-view");
    expect(diff.querySelector("del")?.textContent).toBe("quick");
    expect(diff.querySelector("ins")?.textContent).toBe("fast");
    expect(await store.listHistory()).toHaveLength(1);
  });

  it("supports undo/redo of the revised text", async () => {
    setTransportForTests(mockTransport([openAiChat("Version one."), openAiChat("Version two.")]).transport);
    const user = userEvent.setup();
    render(<HumanizerPage />);
    await user.type(screen.getByRole("textbox", { name: "Original text" }), "Draft.");
    const run = screen.getByRole("button", { name: /Improve text/ });
    await user.click(run);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Revised text" })).toHaveValue("Version one."));
    await user.click(run);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Revised text" })).toHaveValue("Version two."));
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("textbox", { name: "Revised text" })).toHaveValue("Version one.");
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByRole("textbox", { name: "Revised text" })).toHaveValue("Version two.");
  });

  it("shows a localized, key-free error when the provider rejects the key", async () => {
    setTransportForTests(mockTransport([{ status: 401, body: '{"error":{"message":"Incorrect API key provided: sk-proj-SECRETSECRETSECRET1"}}' }]).transport);
    const user = userEvent.setup();
    render(<HumanizerPage />);
    await user.type(screen.getByRole("textbox", { name: "Original text" }), "Hello");
    await user.click(screen.getByRole("button", { name: /Improve text/ }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The provider rejected the API key");
    expect(alert.textContent).not.toContain("SECRETSECRETSECRET1");
    expect(screen.getByRole("button", { name: "Open Settings" })).toBeInTheDocument();
  });

  it("shows where text will be sent", () => {
    render(<HumanizerPage />);
    expect(screen.getByText("api.openai.com")).toBeInTheDocument();
  });
});

describe("Image generation", () => {
  it("shows the setup screen (never a fake image) when no provider key is stored", () => {
    useSettings.setState({ keyStatus: { openai: false, anthropic: false, openai_compatible: false } });
    render(<ImagePage />);
    expect(screen.getByTestId("image-setup")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows provider errors and no image on failure (MOCK provider)", async () => {
    setTransportForTests(mockTransport([{ status: 500, body: "{}" }]).transport);
    useSettings.getState().update({ maxRetries: 0 });
    const user = userEvent.setup();
    render(<ImagePage />);
    await user.type(screen.getByLabelText("Prompt"), "A lighthouse at dusk");
    await user.click(screen.getByRole("button", { name: /Generate image/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("temporary problem");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("displays a generated image from the provider response (MOCK provider)", async () => {
    setTransportForTests(mockTransport([{ status: 200, body: JSON.stringify({ data: [{ b64_json: "iVBORw0KGgo=" }] }) }]).transport);
    const user = userEvent.setup();
    render(<ImagePage />);
    await user.type(screen.getByLabelText("Prompt"), "A lighthouse");
    await user.click(screen.getByRole("radio", { name: "Landscape" }));
    await user.click(screen.getByRole("button", { name: /Generate image/ }));
    const imgs = await screen.findAllByRole("img", { name: "A lighthouse" });
    expect(imgs[0]).toHaveAttribute("src", "data:image/png;base64,iVBORw0KGgo=");
    expect(await store.listImages()).toHaveLength(1);
  });
});

describe("Text analysis", () => {
  it("runs the local similarity check and states its limits", async () => {
    const user = userEvent.setup();
    render(<AnalysisPage />);
    expect(screen.getByText(/not an internet-wide plagiarism search/)).toBeInTheDocument();
    const text = "Renewable energy adoption grew quickly across many regions during the last decade.";
    await user.type(screen.getByLabelText("Document A"), text);
    await user.type(screen.getByLabelText("Document B"), text);
    await user.click(screen.getByRole("button", { name: /Compare documents/ }));
    expect(await screen.findByTestId("similarity-report")).toHaveTextContent("High similarity");
  });

  it("AI detection tab shows no invented score", async () => {
    const user = userEvent.setup();
    render(<AnalysisPage />);
    await user.click(screen.getByRole("radio", { name: "AI-text detection" }));
    const panel = screen.getByTestId("detection-panel");
    expect(panel).toHaveTextContent("never show invented scores");
    expect(panel.textContent).not.toMatch(/\d+%/);
  });
});
