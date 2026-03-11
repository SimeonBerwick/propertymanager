namespace ClipboardWorkflowUtility.Models;

public sealed class AppSettings
{
    public int MaxHistoryItems { get; set; } = 100;
    public bool CapturePaused { get; set; }
}
