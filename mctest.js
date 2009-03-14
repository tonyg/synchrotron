function noisyLoad(filename) {
    print("Loading "+filename+"...");
    load(filename);
}

noisyLoad("json2.js");
noisyLoad("diff.js");
noisyLoad("graph.js");
noisyLoad("sha1.js");
noisyLoad("mc.js");

Mc.Tests = {
    pp: function(x) {
        return JSON.stringify(x, null, 2);
    },

    Rt1: function() {
        var pp = Mc.Tests.pp;

        var repo = new Mc.Repository();
        var fs = new Mc.Checkout(repo);

        function d(x) {
            print(x);
            print(pp({repo: repo,
                      fs: fs}));
            print();
        }

        var fileA = fs.createFile();
        var fileB = fs.createFile();
        d("start");

        fs.setProp(fileA, "name", "File A");
        fs.setProp(fileA, "text", "A B C D E".split(/ /));
        fs.setProp(fileB, "name", "File B");
        fs.setProp(fileB, "text", ["One line"]);
        var rA = repo.commit(fs);
        d("post-rA");
        fs.setBranch("BBB");
        fs.setProp(fileA, "text", "G G G A B C D E".split(/ /));
        var rB1 = repo.commit(fs);
        d("post-rB1");
        fs.setProp(fileA, "text", "A B C D E G G G A B C D E".split(/ /));
        var rB2 = repo.commit(fs);
        d("post-rB2");

        fs = repo.update(rA);
        d("post-update-to-rA");
        fs.setProp(fileA, "name", "File A, renamed");
        fs.setProp(fileA, "text", "A B X D E".split(/ /));
        var rC = repo.commit(fs);
        Mc.Tests.revisionC = rC;
        d("post-rC");

        var mergeResult = repo.merge(rC, rB2);
        print("--------------------");
        print(pp(mergeResult));
        print("--------------------");

        var rMerger = repo.commit(mergeResult.files);
        fs = repo.update(rMerger);
        d("post-rMerger");

        print("branch tip BBB: "+repo.branchTip("BBB"));
        print("branch tip NonExistent: "+repo.branchTip("NonExistent"));
        print();

        fs = repo.update("BBB");
        fs.deleteFile(fileA);
        var rB3 = repo.commit(fs);
        d("post-rB3");

        var rMerger2 = repo.commit(repo.merge(rB3, rMerger).files);
        fs = repo.update(rMerger2);
        d("post-rMerger2");

        print("---------------------------------------------------------------------------");
        Mc.Tests.exportedJson = pp(repo.exportRevisions());
        print(Mc.Tests.exportedJson);
        print("---------------------------------------------------------------------------");

        print(pp({fileArevs: repo.fileRevisions(fileA),
                  fileBrevs: repo.fileRevisions(fileB)}));
    }
};

Mc._debugMode = true;
Mc.Tests.Rt1();
