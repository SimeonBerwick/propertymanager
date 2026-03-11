using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Input;
using ClipboardWorkflowUtility.Data;
using ClipboardWorkflowUtility.Models;
using ClipboardWorkflowUtility.Services;

namespace ClipboardWorkflowUtility.ViewModels;

public sealed class MainViewModel : INotifyPropertyChanged
{
    private readonly IClipboardRepository _repository;
    private readonly ClipboardMonitorService _clipboardService;
    private readonly AppSettings _settings;
    private bool _capturePaused;

    public ObservableCollection<ClipboardItem> HistoryItems { get; } = [];

    public bool CapturePaused
    {
        get => _capturePaused;
        set
        {
            if (_capturePaused == value) return;
            _capturePaused = value;
            _settings.CapturePaused = value;
            _clipboardService.IsPaused = value;
            OnPropertyChanged();
        }
    }

    public ICommand RefreshCommand { get; }
    public ICommand ClearCommand { get; }
    public ICommand CopyItemCommand { get; }
    public ICommand DeleteItemCommand { get; }

    public MainViewModel(IClipboardRepository repository, ClipboardMonitorService clipboardService, AppSettings settings)
    {
        _repository = repository;
        _clipboardService = clipboardService;
        _settings = settings;
        _capturePaused = settings.CapturePaused;

        _clipboardService.ClipboardTextCaptured += OnClipboardTextCaptured;

        RefreshCommand = new RelayCommand(_ => LoadHistory());
        ClearCommand = new RelayCommand(_ =>
        {
            _repository.Clear();
            LoadHistory();
        });
        CopyItemCommand = new RelayCommand(item =>
        {
            if (item is ClipboardItem clipboardItem)
            {
                Clipboard.SetText(clipboardItem.Text);
            }
        });
        DeleteItemCommand = new RelayCommand(item =>
        {
            if (item is ClipboardItem clipboardItem)
            {
                _repository.Delete(clipboardItem.Id);
                LoadHistory();
            }
        });
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public void Start()
    {
        LoadHistory();
        _clipboardService.IsPaused = _settings.CapturePaused;
        _clipboardService.Start();
    }

    private void OnClipboardTextCaptured(string text)
    {
        _repository.SaveText(text, sourceApp: null);
        LoadHistory();
    }

    private void LoadHistory()
    {
        HistoryItems.Clear();
        foreach (var item in _repository.GetRecent(_settings.MaxHistoryItems))
        {
            HistoryItems.Add(item);
        }
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
}

public sealed class RelayCommand : ICommand
{
    private readonly Action<object?> _execute;
    private readonly Predicate<object?>? _canExecute;

    public RelayCommand(Action<object?> execute, Predicate<object?>? canExecute = null)
    {
        _execute = execute;
        _canExecute = canExecute;
    }

    public event EventHandler? CanExecuteChanged;
    public bool CanExecute(object? parameter) => _canExecute?.Invoke(parameter) ?? true;
    public void Execute(object? parameter) => _execute(parameter);
    public void RaiseCanExecuteChanged() => CanExecuteChanged?.Invoke(this, EventArgs.Empty);
}
