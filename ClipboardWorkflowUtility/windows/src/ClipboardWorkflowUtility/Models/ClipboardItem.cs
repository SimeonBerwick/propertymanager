namespace ClipboardWorkflowUtility.Models;

public sealed class ClipboardItem
{
    public Guid Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public string? SourceApp { get; set; }
    public bool Pinned { get; set; }
}
