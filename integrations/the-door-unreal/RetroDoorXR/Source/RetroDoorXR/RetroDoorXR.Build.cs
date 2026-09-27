using UnrealBuildTool;

public class RetroDoorXR : ModuleRules
{
    public RetroDoorXR(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new[]
        {
            "Core",
            "CoreUObject",
            "Engine"
        });

        PrivateDependencyModuleNames.AddRange(new[]
        {
            "HTTP",
            "Json",
            "JsonUtilities"
        });
    }
}
