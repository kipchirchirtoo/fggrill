using System.Windows;

namespace FgGrillPos
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            
            this.DispatcherUnhandledException += (s, args) => {
                Console.WriteLine($"GLOBAL UI THREAD ERROR: {args.Exception}");
                MessageBox.Show($"Global UI Error: {args.Exception.Message}");
                args.Handled = true;
            };

            AppDomain.CurrentDomain.UnhandledException += (s, args) => {
                Console.WriteLine($"GLOBAL DOMAIN ERROR: {args.ExceptionObject}");
                MessageBox.Show($"Global Domain Error: {args.ExceptionObject}");
            };

            TaskScheduler.UnobservedTaskException += (s, args) => {
                Console.WriteLine($"UNOBSERVED TASK ERROR: {args.Exception}");
            };
        }
    }
}
