using System.Windows;
using ClipboardWorkflowUtility.Data;
using ClipboardWorkflowUtility.Services;
using ClipboardWorkflowUtility.ViewModels;
using ClipboardWorkflowUtility.Views;

namespace ClipboardWorkflowUtility;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var settings = new AppSettings();
        var repository = new SqliteClipboardRepository(settings);
        var clipboardService = new ClipboardMonitorService();
        var viewModel = new MainViewModel(repository, clipboardService, settings);

        var window = new MainWindow
        {
            DataContext = viewModel
        };

        window.Show();
        viewModel.Start();
    }
}
