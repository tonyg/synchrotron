try {

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
            print(pp({fs: fs}));
            print();
        }

        d("start");

	fs.writeFile("File A", {"text": "A B C D E".split(/ /)});
	fs.writeFile("File B", {"text": ["One line"]});
        var rA = fs.commit({comment: "First commit"});
        d("post-rA");

        fs.setBranch("BBB");

	fs.writeFile("File A", {"text": "G G G A B C D E".split(/ /)});
        var rB1 = fs.commit({comment: "Second commit"});
        d("post-rB1");

        fs.writeFile("File A", {"text": "A B C D E G G G A B C D E".split(/ /)});
        var rB2 = fs.commit({comment: "Third commit"});
        d("post-rB2");

	fs = new Mc.Checkout(repo, rA);
        d("post-update-to-rA");

	fs.renameFile("File A", "File A, renamed");
        fs.writeFile("File A, renamed", {"text": "A B X D E".split(/ /)});
        var rC = fs.commit({comment: "Fourth commit"});
        d("post-rC");

	fs.merge("BBB");
	d("post-merge");

	var rMerger = fs.commit({comment: "Merge BBB into master"});
	d("post-merge-commit");

        fs = new Mc.Checkout(repo, rMerger);
        d("post-rMerger");

        print("branch tip BBB: "+repo.resolve("BBB"));
        print("branch tip NonExistent: "+repo.resolve("NonExistent"));
        print();

        fs = new Mc.Checkout(repo, "BBB");
	fs.setBranch("BBB");
        fs.deleteFile("File A");
        var rB3 = fs.commit({comment: "Remove the renamed file A"});
        d("post-rB3");

	fs.merge("master");
	d("post-rMerger2");
	var rMerger2 = fs.commit({comment: "Merge master into BBB"});
        d("post-rMerger2-commit");

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

} catch (e) {
    print(uneval(e));
    quit(1);
}
