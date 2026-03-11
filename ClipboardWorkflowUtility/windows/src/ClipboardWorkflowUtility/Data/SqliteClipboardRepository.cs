using ClipboardWorkflowUtility.Models;
using Microsoft.Data.Sqlite;

namespace ClipboardWorkflowUtility.Data;

public sealed class SqliteClipboardRepository : IClipboardRepository
{
    private readonly string _connectionString;
    private readonly AppSettings _settings;

    public SqliteClipboardRepository(AppSettings settings)
    {
        _settings = settings;
        var appData = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ClipboardWorkflowUtility");
        Directory.CreateDirectory(appData);
        var dbPath = Path.Combine(appData, "clipboard.db");
        _connectionString = $"Data Source={dbPath}";
        Initialize();
    }

    public IReadOnlyList<ClipboardItem> GetRecent(int limit)
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT Id, Text, CreatedAtUtc, SourceApp, Pinned
            FROM ClipboardHistory
            ORDER BY CreatedAtUtc DESC
            LIMIT $limit;";
        command.Parameters.AddWithValue("$limit", limit);

        var items = new List<ClipboardItem>();
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            items.Add(new ClipboardItem
            {
                Id = Guid.Parse(reader.GetString(0)),
                Text = reader.GetString(1),
                CreatedAtUtc = DateTime.Parse(reader.GetString(2)).ToUniversalTime(),
                SourceApp = reader.IsDBNull(3) ? null : reader.GetString(3),
                Pinned = reader.GetBoolean(4)
            });
        }

        return items;
    }

    public void SaveText(string text, string? sourceApp)
    {
        var trimmed = text.Trim();
        if (string.IsNullOrWhiteSpace(trimmed)) return;

        var latest = GetRecent(1).FirstOrDefault();
        if (latest is not null && string.Equals(latest.Text, trimmed, StringComparison.Ordinal))
        {
            return;
        }

        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var insert = connection.CreateCommand();
        insert.CommandText = @"
            INSERT INTO ClipboardHistory (Id, Text, CreatedAtUtc, SourceApp, Pinned)
            VALUES ($id, $text, $createdAtUtc, $sourceApp, 0);";
        insert.Parameters.AddWithValue("$id", Guid.NewGuid().ToString());
        insert.Parameters.AddWithValue("$text", trimmed);
        insert.Parameters.AddWithValue("$createdAtUtc", DateTime.UtcNow.ToString("O"));
        insert.Parameters.AddWithValue("$sourceApp", (object?)sourceApp ?? DBNull.Value);
        insert.ExecuteNonQuery();

        EnforceRetention(connection);
    }

    public void Delete(Guid id)
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM ClipboardHistory WHERE Id = $id;";
        command.Parameters.AddWithValue("$id", id.ToString());
        command.ExecuteNonQuery();
    }

    public void Clear()
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM ClipboardHistory;";
        command.ExecuteNonQuery();
    }

    private void Initialize()
    {
        using var connection = new SqliteConnection(_connectionString);
        connection.Open();

        var command = connection.CreateCommand();
        command.CommandText = @"
            CREATE TABLE IF NOT EXISTS ClipboardHistory (
                Id TEXT PRIMARY KEY,
                Text TEXT NOT NULL,
                CreatedAtUtc TEXT NOT NULL,
                SourceApp TEXT NULL,
                Pinned INTEGER NOT NULL DEFAULT 0
            );";
        command.ExecuteNonQuery();
    }

    private void EnforceRetention(SqliteConnection connection)
    {
        var command = connection.CreateCommand();
        command.CommandText = @"
            DELETE FROM ClipboardHistory
            WHERE Id IN (
                SELECT Id FROM ClipboardHistory
                ORDER BY CreatedAtUtc DESC
                LIMIT -1 OFFSET $offset
            );";
        command.Parameters.AddWithValue("$offset", _settings.MaxHistoryItems);
        command.ExecuteNonQuery();
    }
}
