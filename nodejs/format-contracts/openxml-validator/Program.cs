using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;

if (args.Length == 0)
{
    Console.Error.WriteLine("Usage: openxml-validator <document.docx> [...]");
    return 2;
}

var validator = new OpenXmlValidator();
var failed = false;

foreach (var path in args)
{
    try
    {
        using var document = WordprocessingDocument.Open(path, false);
        var errors = validator.Validate(document).ToArray();
        if (errors.Length == 0)
        {
            Console.WriteLine($"Open XML valid: {Path.GetFileName(path)}");
            continue;
        }

        failed = true;
        Console.Error.WriteLine($"{path}: {errors.Length} Open XML validation error(s)");
        foreach (var error in errors)
        {
            var part = error.Part?.Uri.ToString() ?? "(package)";
            var pathText = error.Path?.XPath ?? "(unknown path)";
            Console.Error.WriteLine($"  {part} {pathText}: {error.Description}");
        }
    }
    catch (Exception error)
    {
        failed = true;
        Console.Error.WriteLine($"{path}: could not be opened: {error.Message}");
    }
}

return failed ? 1 : 0;
