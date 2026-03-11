using ClipboardWorkflowUtility.Models;

namespace ClipboardWorkflowUtility.Data;

public interface IClipboardRepository
{
    IReadOnlyList<ClipboardItem> GetRecent(int limit);
    void SaveText(string text, string? sourceApp);
    void Delete(Guid id);
    void Clear();
}
