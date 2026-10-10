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
            "Engine",
            "HTTP"
        });

        PrivateDependencyModuleNames.AddRange(new[]
        {
            "Json",
            "JsonUtilities"
        });
    }
}
