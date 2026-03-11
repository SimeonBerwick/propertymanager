using System.Windows;
using System.Windows.Threading;

namespace ClipboardWorkflowUtility.Services;

public sealed class ClipboardMonitorService
{
    private readonly DispatcherTimer _timer;
    private string? _lastSeenText;
    public bool IsPaused { get; set; }
    public event Action<string>? ClipboardTextCaptured;

    public ClipboardMonitorService()
    {
        _timer = new DispatcherTimer
        {
            Interval = TimeSpan.FromMilliseconds(750)
        };
        _timer.Tick += (_, _) => Poll();
    }

    public void Start() => _timer.Start();
    public void Stop() => _timer.Stop();

    private void Poll()
    {
        if (IsPaused) return;
        if (!Clipboard.ContainsText()) return;

        var text = Clipboard.GetText();
        if (string.IsNullOrWhiteSpace(text)) return;
        if (string.Equals(text, _lastSeenText, StringComparison.Ordinal)) return;

        _lastSeenText = text;
        ClipboardTextCaptured?.Invoke(text);
    }
}
